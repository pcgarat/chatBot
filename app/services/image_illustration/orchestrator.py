"""Orquestador: plan → anclas → Forge (lote) → reintentos tras el primer pase."""

from __future__ import annotations

import html
import re
from collections.abc import Callable, Iterator

from app.services.image_illustration.anchors import (
    insert_scene_markers,
    marker_for,
    replace_marker_with,
    strip_illustration_artifacts,
    strip_transient_illustration_artifacts,
    with_unique_scene_ids,
)
from app.services.image_illustration.models import (
    IllustrationEvent,
    LastGenerationPayload,
    SceneSpec,
)
from app.services.image_illustration.ports import ForgeGenerationPort, LastPayloadSource, ScenePlannerPort
from app.services.image_illustration import status_codes as st


def _img_tag(url: str, scene_id: str) -> str:
    return f'<img src="{url}" alt="escena {scene_id}" class="chat-illustration" loading="lazy" />'


def _error_placeholder(scene_id: str, message: str) -> str:
    safe = html.escape(message or "error")
    return f'<span class="chat-illustration-error" data-scene="{html.escape(scene_id)}">[Imagen fallida: {safe}]</span>'


def _prompt_placeholder(scene_id: str, forge_prompt: str) -> str:
    """Recuadro visible con el prompt que se enviará a Forge mientras genera."""
    safe_id = html.escape(scene_id)
    safe_prompt = html.escape((forge_prompt or "").strip() or "(sin prompt)")
    return (
        f'<span class="chat-illustration-placeholder" data-scene="{safe_id}">'
        f"Generando imagen…\n\n{safe_prompt}"
        f"</span>"
    )


def compose_forge_prompt(scene_prompt: str, extra_prompt: str | None = None) -> str:
    """Une el prompt del planificador con el del panel: «escena. extra»."""
    base = (scene_prompt or "").strip()
    extra = (extra_prompt or "").strip()
    if not extra:
        return base
    if not base:
        return extra
    return f"{base.rstrip('.')}. {extra}"


def _replace_scene_slot(content: str, scene_id: str, replacement: str) -> str:
    """Sustituye marcador, placeholder de prompt o error de una escena."""
    mark = marker_for(scene_id)
    if mark in content:
        return content.replace(mark, replacement)
    escaped = re.escape(scene_id)
    for cls in ("chat-illustration-placeholder", "chat-illustration-error"):
        pat = rf'<span class="{cls}" data-scene="{escaped}">[\s\S]*?</span>'
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
            body = payload.body_with_prompt(forge_prompt)
            image_bytes = forge.generate(payload.mode, body)
            filename = save_image(scene.id, image_bytes)
            url = url_for_saved(filename)
            content = _replace_scene_slot(content, scene.id, _img_tag(url, scene.id))
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
            )
        except Exception as exc:
            still_failed.append(scene)
            err = str(exc)
            content = _replace_scene_slot(
                content, scene.id, _error_placeholder(scene.id, err)
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
    ) -> Iterator[IllustrationEvent]:
        yield st.status_event(st.IMAGES_STARTING, "Iniciando ilustración")
        yield IllustrationEvent(type="log", message=f"Planificando escenas (max={max_images})")
        yield st.status_event(st.IMAGES_PLANNING, "Planificando escenas")
        plan_text = strip_illustration_artifacts(text)
        base_content = strip_transient_illustration_artifacts(text)
        plan = self.planner.plan(plan_text, max_images)
        yield IllustrationEvent(
            type="log",
            message=f"Plan: illustrate={plan.illustrate} reason={plan.reason} scenes={len(plan.scenes)}",
            data={"illustrate": plan.illustrate, "reason": plan.reason},
        )
        yield st.status_event(
            st.IMAGES_PLAN_READY,
            f"Plan de escenas listo ({len(plan.scenes)})",
            total=len(plan.scenes),
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
                            f"Prompt escena {sid}" if sid else "Planificador de prompts (sin escenas)"
                        ),
                    },
                )

        if not plan.illustrate or not plan.scenes:
            yield st.status_event(st.IMAGES_SKIPPED, "Ilustración no aplicable")
            yield IllustrationEvent(type="done", message="sin ilustración", content=text)
            return

        yield st.status_event(st.IMAGES_INSERTING_ANCHORS, "Insertando anclas de imagen")
        plan = with_unique_scene_ids(plan, base_content)
        content = insert_scene_markers(base_content, plan.scenes)
        extra_prompt = (prompt or "").strip()
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
                data={"prompt": forge_prompt},
            )

        yield st.status_event(st.IMAGES_LOADING_FORGE, "Cargando parámetros de generación")
        try:
            payload = self.payload_source.load()
        except Exception as exc:
            yield IllustrationEvent(type="log", message=f"Error cargando último payload: {exc}")
            yield st.status_event(st.IMAGES_ERROR, "Error al cargar parámetros de Forge")
            for scene in plan.scenes:
                content = _replace_scene_slot(
                    content, scene.id, _error_placeholder(scene.id, str(exc))
                )
                yield IllustrationEvent(
                    type="error", scene_id=scene.id, message=str(exc), content=content
                )
            yield IllustrationEvent(type="done", message="fallo payload", content=content)
            return

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

        pending = list(plan.scenes)
        content, pending = yield from _run_pass(
            self.forge,
            self.save_image,
            self.url_for_saved,
            pending,
            payload,
            content,
            pass_name="inicial",
            extra_prompt=extra_prompt,
        )

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
            )

        yield st.status_event(st.IMAGES_DONE, "Ilustración completada")
        yield IllustrationEvent(type="done", message="ilustración completa", content=content)
