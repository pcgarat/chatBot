"""Orquestador: plan → anclas → Forge (lote) → reintentos tras el primer pase."""

from __future__ import annotations

import html
import re
import time
from collections.abc import Callable, Iterator

from app.services.image_illustration.anchors import (
    insert_scene_markers,
    marker_for,
    replace_marker_with,
    strip_illustration_artifacts,
    strip_transient_illustration_artifacts,
    with_unique_scene_ids,
)
from app.services.image_illustration.content_ops import extract_existing_illustration_prompts
from app.services.image_illustration.coverage import (
    analyze_coverage,
    bind_scenes_to_paragraphs,
    format_coverage_block,
    occupied_scenes_from_coverage,
    suggest_distributed_targets,
)
from app.services.image_illustration.models import (
    ForgeParamOverrides,
    IllustrationEvent,
    LastGenerationPayload,
    ScenePlan,
    SceneSpec,
)
from app.services.image_illustration.generation_params import build_stored_generation_params
from app.services.image_illustration.ports import ForgeGenerationPort, LastPayloadSource, ScenePlannerPort
from app.services.image_illustration import status_codes as st


def _img_tag(url: str, scene_id: str, filename: str = "", prompt: str = "") -> str:
    safe_id = html.escape(scene_id)
    attrs = (
        f'src="{html.escape(url)}" alt="escena {safe_id}" '
        f'class="chat-illustration" loading="lazy"'
    )
    if filename:
        attrs += f' data-filename="{html.escape(filename)}"'
    prompt = (prompt or "").strip()
    if prompt:
        attrs += f' data-prompt="{html.escape(prompt, quote=True)}"'
    return f"<img {attrs} />"


def _error_placeholder(scene_id: str, message: str, forge_prompt: str = "") -> str:
    safe = html.escape(message or "error")
    attrs = f'class="chat-illustration-error" data-scene="{html.escape(scene_id)}"'
    prompt = (forge_prompt or "").strip()
    if prompt:
        attrs += f' data-prompt="{html.escape(prompt, quote=True)}"'
    return f"<span {attrs}>[Imagen fallida: {safe}]</span>"


def _prompt_placeholder(scene_id: str, forge_prompt: str) -> str:
    """Recuadro visible con el prompt que se enviará a Forge mientras genera."""
    safe_id = html.escape(scene_id)
    prompt = (forge_prompt or "").strip()
    safe_prompt = html.escape(prompt or "(sin prompt)")
    attrs = (
        f'class="chat-illustration-placeholder" data-scene="{safe_id}"'
        f' data-prompt="{html.escape(prompt, quote=True)}"'
    )
    return f"<span {attrs}>Generando imagen…\n\n{safe_prompt}</span>"


def compose_forge_prompt(scene_prompt: str, extra_prompt: str | None = None) -> str:
    """Une el prompt del planificador con el del panel: «escena. extra»."""
    base = (scene_prompt or "").strip()
    extra = (extra_prompt or "").strip()
    if not extra:
        return base
    if not base:
        return extra
    return f"{base.rstrip('.')}. {extra}"


def _iter_batches(items: list, size: int):
    """Parte una lista en trozos de `size` (mínimo 1)."""
    n = max(1, int(size))
    for i in range(0, len(items), n):
        yield items[i : i + n]


def _replace_scene_slot(content: str, scene_id: str, replacement: str) -> str:
    """Sustituye marcador, placeholder de prompt o error de una escena."""
    mark = marker_for(scene_id)
    if mark in content:
        return content.replace(mark, replacement)
    escaped = re.escape(scene_id)
    for cls in ("chat-illustration-placeholder", "chat-illustration-error"):
        pat = (
            rf'<span\b(?=[^>]*\bclass="{cls}")(?=[^>]*\bdata-scene="{escaped}")[^>]*>'
            rf"[\s\S]*?</span>"
        )
        new, n = re.subn(pat, replacement, content, count=1)
        if n:
            return new
    return content


def _run_pass(
    forge: ForgeGenerationPort,
    save_image: Callable[[str, bytes], str],
    url_for_saved: Callable[[str], str],
    scenes: list[SceneSpec],
    payload: LastGenerationPayload,
    content: str,
    *,
    pass_name: str,
    extra_prompt: str = "",
    forge_overrides: ForgeParamOverrides | None = None,
) -> Iterator[IllustrationEvent]:
    still_failed: list[SceneSpec] = []
    total = len(scenes)
    for index, scene in enumerate(scenes, start=1):
        forge_prompt = compose_forge_prompt(scene.prompt, extra_prompt)
        yield IllustrationEvent(
            type="log",
            message=f"[{pass_name}] Generando escena {scene.id}",
            scene_id=scene.id,
            data={"prompt": forge_prompt},
        )
        yield st.status_event(
            st.IMAGES_SUBMITTING_PROMPT,
            f"Enviando prompt de imagen ({index}/{total})",
            scene_id=scene.id,
            index=index,
            total=total,
        )
        yield st.status_event(
            st.IMAGES_AWAITING_GENERATION,
            f"Esperando generación de imagen ({index}/{total})",
            scene_id=scene.id,
            index=index,
            total=total,
        )
        try:
            body = payload.body_with_prompt(forge_prompt, overrides=forge_overrides)
            t0 = time.perf_counter()
            image_bytes = forge.generate(payload.mode, body)
            generation_time_ms = (time.perf_counter() - t0) * 1000.0
            filename = save_image(scene.id, image_bytes)
            url = url_for_saved(filename)
            content = _replace_scene_slot(
                content, scene.id, _img_tag(url, scene.id, filename, forge_prompt)
            )
            stored_params = build_stored_generation_params(
                payload.mode,
                body,
                generation_time_ms=generation_time_ms,
            )
            yield st.status_event(
                st.IMAGES_IMAGE_READY,
                f"Imagen recibida ({index}/{total})",
                scene_id=scene.id,
                index=index,
                total=total,
            )
            yield IllustrationEvent(
                type="image",
                scene_id=scene.id,
                url=url,
                message="ok",
                content=content,
                data={
                    "filename": filename,
                    "params": stored_params,
                    "mode": payload.mode.value,
                },
            )
        except Exception as exc:
            still_failed.append(scene)
            err = str(exc)
            content = _replace_scene_slot(
                content, scene.id, _error_placeholder(scene.id, err, forge_prompt)
            )
            yield st.status_event(
                st.IMAGES_IMAGE_FAILED,
                f"Error al generar imagen ({index}/{total})",
                scene_id=scene.id,
                index=index,
                total=total,
            )
            yield IllustrationEvent(
                type="error",
                scene_id=scene.id,
                message=err,
                content=content,
            )
    return (content, still_failed)


class ImageIllustrationOrchestrator:
    """Orquesta ilustración con pases de generación y reintentos al final."""

    def __init__(
        self,
        planner: ScenePlannerPort,
        payload_source: LastPayloadSource,
        forge: ForgeGenerationPort,
        save_image: Callable[[str, bytes], str],
        *,
        url_for_saved: Callable[[str], str] | None = None,
    ):
        self.planner = planner
        self.payload_source = payload_source
        self.forge = forge
        self.save_image = save_image
        self.url_for_saved = url_for_saved or (lambda name: f"/api/illustrated-images/{name}")

    def run(
        self,
        text: str,
        *,
        max_images: int,
        retries: int,
        prompt: str = "",
        include_prompt_debug: bool = False,
        batch_size: int = 10,
        existing_prompts: list[str] | None = None,
        forge_overrides: ForgeParamOverrides | None = None,
    ) -> Iterator[IllustrationEvent]:
        yield st.status_event(st.IMAGES_STARTING, "Iniciando ilustración")
        batch_n = max(1, int(batch_size))
        yield IllustrationEvent(
            type="log",
            message=f"Planificando escenas (max={max_images}, lote={batch_n})",
        )
        plan_text = strip_illustration_artifacts(text)
        content = strip_transient_illustration_artifacts(text)
        extra_prompt = (prompt or "").strip()
        overrides = forge_overrides

        coverage = analyze_coverage(text)
        remaining_quota = max(0, int(max_images))
        already_planned: list[SceneSpec] = occupied_scenes_from_coverage(coverage)
        known_prompts: list[str] = []
        seen_prompts: set[str] = set()
        for p in list(extract_existing_illustration_prompts(text)) + list(
            existing_prompts or []
        ):
            p = (p or "").strip()
            if p and p not in seen_prompts:
                seen_prompts.add(p)
                known_prompts.append(p)
        # Solo evita duplicar párrafo dentro de esta ejecución; la cobertura
        # existente se prioriza vía huecos entre imágenes (punto medio).
        reserved_paragraphs: set[int] = set()
        payload: LastGenerationPayload | None = None
        batch_idx = 0
        any_batch = False

        while remaining_quota > 0:
            requested = min(batch_n, remaining_quota)
            batch_idx += 1
            suggested = suggest_distributed_targets(
                coverage, requested, also_avoid=reserved_paragraphs
            )
            assigned = [
                coverage.paragraphs[i]
                for i in suggested
                if 0 <= i < len(coverage.paragraphs)
            ]
            if not assigned:
                if not any_batch:
                    yield st.status_event(st.IMAGES_SKIPPED, "Ilustración no aplicable")
                    yield IllustrationEvent(
                        type="done", message="sin ilustración", content=text
                    )
                    return
                break

            coverage_block = format_coverage_block(
                coverage, suggested=[p.index for p in assigned]
            )
            yield st.status_event(
                st.IMAGES_PLANNING,
                f"Planificando prompts (lote {batch_idx})",
                index=batch_idx,
                total=None,
                batch=batch_idx,
                batch_size=len(assigned),
            )
            yield IllustrationEvent(
                type="log",
                message=(
                    f"Lote {batch_idx}: párrafos asignados "
                    f"{[p.index for p in assigned]} → pidiendo prompts al LLM"
                ),
                data={
                    "batch": batch_idx,
                    "assigned_paragraphs": [p.index for p in assigned],
                },
            )
            plan = self.planner.plan(
                plan_text,
                len(assigned),
                already_planned=already_planned or None,
                coverage_block=coverage_block,
                assigned_paragraphs=assigned,
                existing_prompts=known_prompts or None,
            )
            if plan.illustrate and plan.scenes:
                bound = bind_scenes_to_paragraphs(plan.scenes, assigned)
                plan = ScenePlan(
                    illustrate=bool(bound),
                    reason=plan.reason,
                    scenes=bound,
                )
            yield IllustrationEvent(
                type="log",
                message=(
                    f"Lote {batch_idx}: illustrate={plan.illustrate} "
                    f"reason={plan.reason} scenes={len(plan.scenes)} "
                    f"(asignados={len(assigned)})"
                ),
                data={
                    "illustrate": plan.illustrate,
                    "reason": plan.reason,
                    "batch": batch_idx,
                    "requested": len(assigned),
                    "scenes": len(plan.scenes),
                    "assigned_paragraphs": [p.index for p in assigned],
                },
            )

            planner_debug = getattr(self.planner, "last_debug", None)
            if include_prompt_debug and isinstance(planner_debug, dict):
                scenes_for_debug = plan.scenes if plan.scenes else [None]
                for scene in scenes_for_debug:
                    sid = scene.id if scene else None
                    scene_prompt = scene.prompt if scene else ""
                    yield IllustrationEvent(
                        type="llm_debug",
                        scene_id=sid,
                        message=scene_prompt or (plan.reason or "Planificador de prompts"),
                        data={
                            "debug_request": planner_debug.get("debug_request") or "",
                            "debug_response": planner_debug.get("debug_response") or "",
                            "label": (
                                f"Prompt escena {sid} (lote {batch_idx})"
                                if sid
                                else f"Planificador de prompts (lote {batch_idx}, sin escenas)"
                            ),
                            "batch": batch_idx,
                        },
                    )

            if not plan.illustrate or not plan.scenes:
                if not any_batch:
                    yield st.status_event(st.IMAGES_SKIPPED, "Ilustración no aplicable")
                    yield IllustrationEvent(
                        type="done", message="sin ilustración", content=text
                    )
                    return
                break

            plan = with_unique_scene_ids(plan, content)
            yield st.status_event(
                st.IMAGES_PLAN_READY,
                f"Plan de escenas listo (lote {batch_idx}, {len(plan.scenes)})",
                total=len(plan.scenes),
                batch=batch_idx,
            )
            yield st.status_event(
                st.IMAGES_INSERTING_ANCHORS,
                f"Insertando anclas de imagen (lote {batch_idx})",
                batch=batch_idx,
            )
            content = insert_scene_markers(content, plan.scenes)
            for scene in plan.scenes:
                forge_prompt = compose_forge_prompt(scene.prompt, extra_prompt)
                content = replace_marker_with(
                    content, scene.id, _prompt_placeholder(scene.id, forge_prompt)
                )
                yield IllustrationEvent(
                    type="placeholder",
                    scene_id=scene.id,
                    message=forge_prompt,
                    content=content,
                    data={"prompt": forge_prompt, "batch": batch_idx},
                )

            if payload is None:
                yield st.status_event(
                    st.IMAGES_LOADING_FORGE, "Cargando parámetros de generación"
                )
                try:
                    payload = self.payload_source.load()
                except Exception as exc:
                    yield IllustrationEvent(
                        type="log", message=f"Error cargando último payload: {exc}"
                    )
                    yield st.status_event(
                        st.IMAGES_ERROR, "Error al cargar parámetros de Forge"
                    )
                    for scene in plan.scenes:
                        forge_prompt = compose_forge_prompt(scene.prompt, extra_prompt)
                        content = _replace_scene_slot(
                            content,
                            scene.id,
                            _error_placeholder(scene.id, str(exc), forge_prompt),
                        )
                        yield IllustrationEvent(
                            type="error",
                            scene_id=scene.id,
                            message=str(exc),
                            content=content,
                        )
                    yield IllustrationEvent(
                        type="done", message="fallo payload", content=content
                    )
                    return
                yield from self._emit_payload_log(payload)

            yield IllustrationEvent(
                type="log",
                message=f"Generando lote {batch_idx} ({len(plan.scenes)} escenas)",
                data={"batch": batch_idx, "scenes": len(plan.scenes)},
            )
            pending = list(plan.scenes)
            content, pending = yield from _run_pass(
                self.forge,
                self.save_image,
                self.url_for_saved,
                pending,
                payload,
                content,
                pass_name=f"lote-{batch_idx}",
                extra_prompt=extra_prompt,
                forge_overrides=overrides,
            )
            content, pending = yield from self._retry_failed(
                pending,
                payload,
                content,
                retries=retries,
                extra_prompt=extra_prompt,
                forge_overrides=overrides,
            )

            already_planned.extend(plan.scenes)
            for scene in plan.scenes:
                if scene.paragraph_index is not None:
                    reserved_paragraphs.add(scene.paragraph_index)
                prompt = (scene.prompt or "").strip()
                if prompt and prompt not in seen_prompts:
                    seen_prompts.add(prompt)
                    known_prompts.append(prompt)
            remaining_quota -= len(plan.scenes)
            any_batch = True
            # Recalcular cobertura sobre el content ya anclado (placeholders cuentan).
            coverage = analyze_coverage(content)
            # Si el LLM no cubrió todos los párrafos asignados, no forzar más lotes.
            if len(plan.scenes) < len(assigned):
                break

        yield st.status_event(st.IMAGES_DONE, "Ilustración completada")
        yield IllustrationEvent(type="done", message="ilustración completa", content=content)

    def run_at(
        self,
        text: str,
        *,
        paragraph_index: int,
        selected_excerpt: str = "",
        retries: int,
        prompt: str = "",
        include_prompt_debug: bool = False,
        existing_prompts: list[str] | None = None,
        forge_overrides: ForgeParamOverrides | None = None,
    ) -> Iterator[IllustrationEvent]:
        """Una imagen en el párrafo elegido; si ya hay fotos, se inserta al lado."""
        yield st.status_event(st.IMAGES_STARTING, "Iniciando ilustración en párrafo")
        plan_text = strip_illustration_artifacts(text)
        content = strip_transient_illustration_artifacts(text)
        extra_prompt = (prompt or "").strip()
        overrides = forge_overrides
        coverage = analyze_coverage(text)
        if not coverage.paragraphs:
            yield st.status_event(st.IMAGES_SKIPPED, "El mensaje no tiene párrafos")
            yield IllustrationEvent(
                type="done", message="sin párrafos", content=text
            )
            return
        if paragraph_index < 0 or paragraph_index >= len(coverage.paragraphs):
            yield st.status_event(st.IMAGES_SKIPPED, "Párrafo fuera de rango")
            yield IllustrationEvent(
                type="done", message="párrafo fuera de rango", content=text
            )
            return

        assigned = [coverage.paragraphs[paragraph_index]]
        known_prompts: list[str] = []
        seen_prompts: set[str] = set()
        for p in list(extract_existing_illustration_prompts(text)) + list(
            existing_prompts or []
        ):
            p = (p or "").strip()
            if p and p not in seen_prompts:
                seen_prompts.add(p)
                known_prompts.append(p)

        yield st.status_event(
            st.IMAGES_PLANNING,
            f"Planificando prompt (párrafo {paragraph_index})",
            index=1,
            total=1,
        )
        yield IllustrationEvent(
            type="log",
            message=(
                f"Ubicación fijada: párrafo {paragraph_index} "
                f"(imágenes previas={assigned[0].illustration_count})"
            ),
            data={
                "paragraph_index": paragraph_index,
                "selected_excerpt": (selected_excerpt or "").strip(),
            },
        )
        plan = self.planner.plan(
            plan_text,
            1,
            assigned_paragraphs=assigned,
            existing_prompts=known_prompts or None,
            pinned=True,
            focus_excerpt=(selected_excerpt or "").strip() or None,
        )
        if plan.illustrate and plan.scenes:
            bound = bind_scenes_to_paragraphs(plan.scenes, assigned)
            plan = ScenePlan(
                illustrate=bool(bound),
                reason=plan.reason,
                scenes=bound[:1] if bound else [],
            )

        planner_debug = getattr(self.planner, "last_debug", None)
        if include_prompt_debug and isinstance(planner_debug, dict):
            scenes_for_debug = plan.scenes if plan.scenes else [None]
            for scene in scenes_for_debug:
                sid = scene.id if scene else None
                scene_prompt = scene.prompt if scene else ""
                yield IllustrationEvent(
                    type="llm_debug",
                    scene_id=sid,
                    message=scene_prompt or (plan.reason or "Planificador de prompts"),
                    data={
                        "debug_request": planner_debug.get("debug_request") or "",
                        "debug_response": planner_debug.get("debug_response") or "",
                        "label": (
                            f"Prompt escena {sid} (párrafo {paragraph_index})"
                            if sid
                            else f"Planificador de prompts (párrafo {paragraph_index})"
                        ),
                        "paragraph_index": paragraph_index,
                    },
                )

        if not plan.illustrate or not plan.scenes:
            yield st.status_event(
                st.IMAGES_SKIPPED,
                plan.reason or "No se pudo planificar la escena",
            )
            yield IllustrationEvent(
                type="done",
                message=plan.reason or "sin ilustración",
                content=text,
            )
            return

        plan = with_unique_scene_ids(plan, content)
        yield st.status_event(st.IMAGES_PLAN_READY, "Plan de escena listo", total=1)
        yield st.status_event(st.IMAGES_INSERTING_ANCHORS, "Insertando ancla de imagen")
        content = insert_scene_markers(content, plan.scenes)
        for scene in plan.scenes:
            forge_prompt = compose_forge_prompt(scene.prompt, extra_prompt)
            content = replace_marker_with(
                content, scene.id, _prompt_placeholder(scene.id, forge_prompt)
            )
            yield IllustrationEvent(
                type="placeholder",
                scene_id=scene.id,
                message=forge_prompt,
                content=content,
                data={"prompt": forge_prompt, "paragraph_index": paragraph_index},
            )

        yield st.status_event(
            st.IMAGES_LOADING_FORGE, "Cargando parámetros de generación"
        )
        try:
            payload = self.payload_source.load()
        except Exception as exc:
            yield IllustrationEvent(
                type="log", message=f"Error cargando último payload: {exc}"
            )
            yield st.status_event(
                st.IMAGES_ERROR, "Error al cargar parámetros de Forge"
            )
            for scene in plan.scenes:
                forge_prompt = compose_forge_prompt(scene.prompt, extra_prompt)
                content = _replace_scene_slot(
                    content,
                    scene.id,
                    _error_placeholder(scene.id, str(exc), forge_prompt),
                )
                yield IllustrationEvent(
                    type="error",
                    scene_id=scene.id,
                    message=str(exc),
                    content=content,
                )
            yield IllustrationEvent(
                type="done", message="fallo payload", content=content
            )
            return
        yield from self._emit_payload_log(payload)

        pending = list(plan.scenes)
        content, pending = yield from _run_pass(
            self.forge,
            self.save_image,
            self.url_for_saved,
            pending,
            payload,
            content,
            pass_name="at-paragraph",
            extra_prompt=extra_prompt,
            forge_overrides=overrides,
        )
        content, pending = yield from self._retry_failed(
            pending,
            payload,
            content,
            retries=retries,
            extra_prompt=extra_prompt,
            forge_overrides=overrides,
        )

        yield st.status_event(st.IMAGES_DONE, "Ilustración completada")
        yield IllustrationEvent(type="done", message="ilustración completa", content=content)

    def run_remaining(
        self,
        text: str,
        *,
        retries: int,
        batch_size: int = 10,
        forge_overrides: ForgeParamOverrides | None = None,
    ) -> Iterator[IllustrationEvent]:
        """
        Regenera anclas/placeholders/errores pendientes sin re-planificar.
        Usa el prompt guardado en el ancla; omite marcadores sin prompt.
        Genera en lotes de `batch_size`.
        """
        from app.services.image_illustration.content_ops import (
            extract_pending_illustration_scenes,
        )

        yield st.status_event(st.IMAGES_STARTING, "Reanudando imágenes pendientes")
        pending_slots = extract_pending_illustration_scenes(text)
        regenerable = [s for s in pending_slots if (s.prompt or "").strip()]
        skipped = [s for s in pending_slots if not (s.prompt or "").strip()]
        batch_n = max(1, int(batch_size))
        overrides = forge_overrides
        yield IllustrationEvent(
            type="log",
            message=(
                f"Pendientes={len(pending_slots)} regenerables={len(regenerable)} "
                f"sin_prompt={len(skipped)} lote={batch_n}"
            ),
            data={
                "pending": len(pending_slots),
                "regenerable": len(regenerable),
                "skipped_no_prompt": [s.id for s in skipped],
                "batch_size": batch_n,
            },
        )
        for slot in skipped:
            yield IllustrationEvent(
                type="log",
                message=f"Omitida escena {slot.id}: sin prompt recuperable",
                scene_id=slot.id,
            )

        if not regenerable:
            yield st.status_event(st.IMAGES_SKIPPED, "No hay imágenes pendientes regenerables")
            yield IllustrationEvent(
                type="done",
                message="sin pendientes regenerables",
                content=text,
            )
            return

        content = text
        scenes = [SceneSpec(id=s.id, prompt=s.prompt.strip()) for s in regenerable]
        for scene in scenes:
            content = _replace_scene_slot(
                content, scene.id, _prompt_placeholder(scene.id, scene.prompt)
            )
            yield IllustrationEvent(
                type="placeholder",
                scene_id=scene.id,
                message=scene.prompt,
                content=content,
                data={"prompt": scene.prompt},
            )

        yield st.status_event(st.IMAGES_LOADING_FORGE, "Cargando parámetros de generación")
        try:
            payload = self.payload_source.load()
        except Exception as exc:
            yield IllustrationEvent(type="log", message=f"Error cargando último payload: {exc}")
            yield st.status_event(st.IMAGES_ERROR, "Error al cargar parámetros de Forge")
            for scene in scenes:
                content = _replace_scene_slot(
                    content,
                    scene.id,
                    _error_placeholder(scene.id, str(exc), scene.prompt),
                )
                yield IllustrationEvent(
                    type="error", scene_id=scene.id, message=str(exc), content=content
                )
            yield IllustrationEvent(type="done", message="fallo payload", content=content)
            return

        yield from self._emit_payload_log(payload)

        for batch_idx, chunk in enumerate(_iter_batches(scenes, batch_n), start=1):
            yield IllustrationEvent(
                type="log",
                message=f"Generando restantes lote {batch_idx} ({len(chunk)} escenas)",
                data={"batch": batch_idx, "scenes": len(chunk)},
            )
            pending = list(chunk)
            content, pending = yield from _run_pass(
                self.forge,
                self.save_image,
                self.url_for_saved,
                pending,
                payload,
                content,
                pass_name=f"restantes-{batch_idx}",
                extra_prompt="",
                forge_overrides=overrides,
            )
            content, pending = yield from self._retry_failed(
                pending,
                payload,
                content,
                retries=retries,
                extra_prompt="",
                forge_overrides=overrides,
            )

        yield st.status_event(st.IMAGES_DONE, "Imágenes restantes completadas")
        yield IllustrationEvent(type="done", message="restantes completadas", content=content)

    def _emit_payload_log(self, payload: LastGenerationPayload) -> Iterator[IllustrationEvent]:
        yield IllustrationEvent(
            type="log",
            message=(
                f"ReplayLastGeneration mode={payload.mode.value} "
                f"recovered={payload.recovered_fields} notes={payload.omitted_notes}"
            ),
            data={
                "mode": payload.mode.value,
                "recovered_fields": payload.recovered_fields,
                "omitted_notes": payload.omitted_notes,
                "source_image_path": payload.source_image_path,
            },
        )

    def _retry_failed(
        self,
        pending: list[SceneSpec],
        payload: LastGenerationPayload,
        content: str,
        *,
        retries: int,
        extra_prompt: str,
        forge_overrides: ForgeParamOverrides | None = None,
    ) -> Iterator[IllustrationEvent]:
        attempt = 0
        while pending and attempt < max(0, retries):
            attempt += 1
            yield IllustrationEvent(
                type="log",
                message=f"Reintento {attempt}/{retries} de {len(pending)} escenas fallidas",
            )
            yield st.status_event(
                st.IMAGES_RETRYING,
                f"Reintentando imágenes fallidas ({attempt}/{retries})",
                index=attempt,
                total=retries,
            )
            content, pending = yield from _run_pass(
                self.forge,
                self.save_image,
                self.url_for_saved,
                pending,
                payload,
                content,
                pass_name=f"retry-{attempt}",
                extra_prompt=extra_prompt,
                forge_overrides=forge_overrides,
            )
        return (content, pending)
