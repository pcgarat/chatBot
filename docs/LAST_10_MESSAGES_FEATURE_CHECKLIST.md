# Checklist: Enviar últimos N mensajes a Ollama

## Descripción de la funcionalidad

A partir de ahora las peticiones a Ollama tendrán la siguiente estructura:

1. **Rol `system`**: Instrucciones para el LLM (siempre se envían, sin checkbox)
2. **Últimos N pares** (user + assistant) de la conversación: ordenados de más antiguo a más nuevo
3. **Rol `user`**: El prompt actual del usuario

N se configura via `OLLAMA_HISTORY_TURNS` (default 10).

## Cambios eliminados

- ❌ Checkbox "Enviar instrucciones solo cada X mensajes" (frontend)
- ❌ Input numérico de frecuencia de instrucciones (frontend)
- ❌ Lógica de `inject_instruction_every` (backend)

---

## Checklist de implementación

### 1. BACKEND - Modificar `app/routers/api_conversations.py`

- [x] **1.1** Modificar función `_build_ollama_messages()`:
  - [x] Eliminar lógica de `inject_instruction_every` (siempre enviar instrucciones)
  - [x] Añadir los últimos N pares del historial (`settings.ollama_history_turns`)
  - [x] Ordenar: primero system, luego historial (de más antiguo a más nuevo), luego prompt actual
  - [x] Si no hay suficientes mensajes, enviar los que haya

- [x] **1.2** Actualizar `send_message_stream()`:
  - [x] Eliminar o ignorar el parámetro `inject_instruction_every` del body
  - [x] Eliminar la actualización de `inject_instruction_every` en la conversación
  - [x] El flag `injecting` sigue en el streaming (compatibilidad con frontend; puede eliminarse cuando se limpie el frontend)

- [x] **1.3** Actualizar `send_message()` (endpoint no-streaming):
  - [x] Aplicar los mismos cambios que en `send_message_stream()`

### 2. BACKEND - Config y variable de entorno

- [x] **2.0** Añadir `OLLAMA_HISTORY_TURNS` en `app/config.py`:
  - [x] Variable de entorno, default 10
  - [x] Validador para valores vacíos/inválidos

### 3. BACKEND - Modificar `app/schemas.py`

- [x] **3.1** En `MessageSend`:
  - [x] Mantener `inject_instruction_every` por compatibilidad (se ignora en el backend)

- [x] **3.2** Revisar si `ConversationCreate` y `ConversationUpdate` necesitan cambios:
  - [x] El campo `inject_instruction_every` se mantiene en el modelo pero no se usa

### 4. FRONTEND - Modificar `app/static/index.html`

- [x] **4.1** Eliminar el bloque del checkbox de instrucciones:
  ```html
  <!-- ELIMINAR este div completo -->
  <div class="inject-every">
    <label class="inject-every-label">
      <input type="checkbox" id="inject-instruction-every-check" />
      <span class="inject-every-text">Enviar instrucciones solo cada</span>
    </label>
    <input type="number" id="inject-instruction-every-n" min="1" value="5" class="inject-every-n" />
    <span class="inject-every-suffix">mensajes</span>
  </div>
  ```

### 5. FRONTEND - Modificar `app/static/js/app.js`

- [x] **5.1** Eliminar referencias a elementos del DOM:
  - [x] `injectInstructionEveryCheck`
  - [x] `injectInstructionEveryN`

- [x] **5.2** Eliminar lógica en `setCurrentConversation()`:
  - [x] Líneas que manejan `inject_instruction_every` y el checkbox/input

- [x] **5.3** Eliminar lógica en `newConversation()`:
  - [x] Eliminar cálculo de `injectEvery`
  - [x] Eliminar envío de `inject_instruction_every` en el body

- [x] **5.4** Eliminar lógica en `saveConversation()`:
  - [x] Eliminar cálculo de `injectEvery`
  - [x] Eliminar envío de `inject_instruction_every` en el body

- [x] **5.5** Eliminar lógica en `sendMessage()`:
  - [x] Eliminar cálculo de `injectEvery`
  - [x] Eliminar envío de `inject_instruction_every` en el body
  - [x] Eliminar manejo de `data.injecting_instruction` del streaming

- [x] **5.6** Eliminar event listeners:
  - [x] Listener del checkbox `inject-instruction-every-check`
  - [x] Lógica de habilitar/deshabilitar el input numérico

### 6. BACKEND - Modelo y CRUD (Opcional)

- [x] **6.1** Decidir si eliminar campo `inject_instruction_every` del modelo `Conversation`:
  - Opción A: Mantenerlo para compatibilidad con datos existentes (recomendado) ✅
  - Opción B: Crear migración para eliminarlo

- [x] **6.2** Si se mantiene el campo, documentar que está deprecado

### 7. CSS (Opcional)

- [x] **7.1** Revisar `app/static/css/style.css`:
  - [x] Eliminar estilos relacionados con `.inject-every*`

---

## Tests

- [x] **T1** Test unitario: `_build_ollama_messages()` construye correctamente la lista de mensajes
- [x] **T2** Test unitario: Se envían exactamente los últimos N pares (según OLLAMA_HISTORY_TURNS)
- [x] **T3** Test unitario: El orden es correcto (system → historial antiguo→nuevo → prompt actual)
- [x] **T4** Test integración: Endpoint streaming devuelve respuesta correcta (tests existentes pasan)
- [x] **T5** Test integración: Endpoint no-streaming devuelve respuesta correcta (tests existentes pasan)
- [ ] **T6** Test E2E: Frontend envía mensaje y recibe respuesta correctamente (manual)

---

## Estructura final de mensajes enviados a Ollama

```python
[
    {
        "role": "system",
        "content": "<instrucciones_globales>\n\n<contexto_rag_si_existe>"
    },
    # Últimos N pares de la conversación (máximo 2*N mensajes)
    {"role": "user", "content": "<mensaje_usuario_antiguo_1>"},
    {"role": "assistant", "content": "<respuesta_asistente_1>"},
    {"role": "user", "content": "<mensaje_usuario_antiguo_2>"},
    {"role": "assistant", "content": "<respuesta_asistente_2>"},
    # ... hasta N pares (o los que haya si hay menos)
    # Prompt actual
    {"role": "user", "content": "<prompt_actual>"}
]
```

---

## Notas importantes

1. **Orden de mensajes**: De más antiguo a más nuevo. Si hay 25 mensajes y N=10, se toman los últimos 20 (10 pares).

2. **Contexto RAG**: Se mantiene. Se inyecta en el message system junto con las instrucciones.

3. **Instruction override**: Se mantiene. Es la instrucción específica para un mensaje puntual.

4. **Compatibilidad**: El campo `inject_instruction_every` puede seguir existiendo en la BD/schemas pero se ignora.

5. **System message**: Siempre se envía si hay instrucciones globales o contexto RAG. Si ambos están vacíos, no se envía message system.

6. **Variable de entorno `OLLAMA_HISTORY_TURNS`**: Configura el número de pares (user+assistant) a enviar. Por defecto 10. Si no hay suficientes mensajes al iniciar una conversación, se envían los que haya. Valor 0 = sin historial.

---

## Archivos afectados

| Archivo | Estado |
|---------|--------|
| `app/config.py` | ✅ OLLAMA_HISTORY_TURNS añadido |
| `app/routers/api_conversations.py` | ✅ Modificado |
| `app/schemas.py` | ✅ Sin cambios (compatibilidad) |
| `app/static/index.html` | ✅ Checkbox eliminado |
| `app/static/js/app.js` | ✅ Lógica eliminada |
| `app/static/css/style.css` | ✅ Estilos eliminados |
| `.env.example` | ✅ OLLAMA_HISTORY_TURNS documentado |
| `tests/` | ✅ Tests unitarios para historial añadidos |
