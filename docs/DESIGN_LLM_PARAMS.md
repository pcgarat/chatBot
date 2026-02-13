# Diseño: Parámetros de generación por proveedor

## Objetivos

1. **Por proveedor**: cada provider (ollama, mancer, …) expone un subconjunto de parámetros; solo esos se muestran/activan en la UI.
2. **Solo si el usuario cambia**: si el usuario no modifica un parámetro, no se envía (se usa el default del proveedor).
3. **Configuración en archivo**: los parámetros activos por proveedor y su mapeo a la API se definen en un archivo de configuración (no hardcode en código).

---

## 1. Archivo de configuración por proveedor

**Ubicación sugerida:** `app/config/provider_params.yaml` (o `config/provider_params.yaml` en la raíz).

**Formato (YAML):** un único archivo con una sección por proveedor. Cada parámetro tiene:
- `api_key`: nombre del campo en la API de ese proveedor (puede ser anidado, ej. `options.temperature` para Ollama).
- `default`: valor por defecto (opcional; si se omite, “no enviar” = dejar default del backend).
- `type`: `float`, `int`, `string`, `string_list`, `boolean` (para validación y UI).
- `min` / `max`: opcionales, para rangos (sliders o validación).

Ejemplo mínimo:

```yaml
# provider_params.yaml
ollama:
  temperature:
    api_key: "options.temperature"
    type: float
    default: 0.8
    min: 0
    max: 2
  top_p:
    api_key: "options.top_p"
    type: float
    default: 0.9
    min: 0
    max: 1
  top_k:
    api_key: "options.top_k"
    type: int
    default: 40
    min: 0
    max: 100
  num_predict:
    api_key: "options.num_predict"
    type: int
    default: 128
    min: -1
    max: 4096
  seed:
    api_key: "options.seed"
    type: int
    default: 0
  stop:
    api_key: "options.stop"
    type: string_list
    default: []
  # num_ctx, repeat_penalty, etc. según necesidad

mancer:
  temperature:
    api_key: "temperature"
    type: float
    default: 1.0
    min: 0
    max: 2
  max_tokens:
    api_key: "max_tokens"
    type: int
    default: 1024
    min: 1
    max: 128000
  top_p:
    api_key: "top_p"
    type: float
    default: 1.0
    min: 0
    max: 1
  stop:
    api_key: "stop"
    type: string_list
    default: []
```

**Alternativa:** mismo contenido en JSON (`provider_params.json`) si se prefiere no añadir dependencia a PyYAML (Python ya puede cargar JSON).

**Carga en backend:** un módulo dedicado, por ejemplo `app/provider_params.py`, que:
- Lee el YAML/JSON al arranque (o bajo demanda con caché).
- Expone: `get_params_config(provider_name) -> dict[str, ParamSpec]` y opcionalmente `list_providers_with_params() -> list[str]`.
- `ParamSpec` es un dataclass o dict con: `api_key`, `type`, `default`, `min`, `max` (y si hace falta `label`/`description` para la UI; si no, el front puede seguir usando `llm-params-help.json` para textos).

---

## 2. API backend

### 2.1 Endpoint: parámetros soportados por proveedor

**GET** `/api/providers/{provider}/params`

**Respuesta:** lista (o mapa) de parámetros que ese proveedor soporta, con la información necesaria para la UI y para saber el default.

Ejemplo:

```json
{
  "provider": "ollama",
  "params": {
    "temperature": {
      "type": "float",
      "default": 0.8,
      "min": 0,
      "max": 2,
      "api_key": "options.temperature"
    },
    "top_p": { "type": "float", "default": 0.9, "min": 0, "max": 1, "api_key": "options.top_p" },
    "top_k": { "type": "int", "default": 40, "min": 0, "max": 100, "api_key": "options.top_k" },
    "num_predict": { "type": "int", "default": 128, "min": -1, "max": 4096, "api_key": "options.num_predict" },
    "seed": { "type": "int", "default": 0, "api_key": "options.seed" },
    "stop": { "type": "string_list", "default": [], "api_key": "options.stop" }
  }
}
```

- Si el proveedor no está en el archivo de configuración, devolver `params: {}` (o 404, según criterio).
- El frontend usa esto para: activar/desactivar controles por proveedor y conocer el `default` para “solo enviar si el usuario cambió”.

### 2.2 Envío de mensaje con parámetros opcionales

**Body de** `POST /api/conversations/{id}/messages/stream` (y el endpoint no-stream si se usa):

- Añadir un campo opcional, por ejemplo: `model_params: Optional[dict[str, Any]] = None`.
- **Semántica:** solo incluir en `model_params` los parámetros que el usuario ha **modificado** respecto al default. Si `model_params` es `null` o `{}`, el backend no envía ningún parámetro extra (el proveedor usa sus defaults).

Ejemplo de body:

```json
{
  "content": "Explícame top_p en una frase.",
  "instruction_override": null,
  "system_instruction_global": "...",
  "save_to_chromadb": "user",
  "model_params": {
    "temperature": 0.3,
    "num_predict": 256
  }
}
```

- Backend: recibe `model_params`; si está vacío o no viene, no añade nada al payload del proveedor. Si viene con claves, se traducen a la API del proveedor usando `api_key` del config (ver siguiente sección).

---

## 3. Uso de la configuración en el backend al llamar al proveedor

### 3.1 Mapeo genérico → API del proveedor

En el router (o en un helper usado por el router), antes de llamar a `provider.chat_stream(...)`:

1. Obtener la config del proveedor: `specs = get_params_config(provider_name)`.
2. Para cada clave `k` en `model_params` (solo las que envió el cliente):
   - Si `k` no está en `specs`, ignorar (o log de advertencia).
   - Obtener `api_key` (ej. `"options.temperature"`) y el valor ya validado/convertido según `type`.
   - Escribir el valor en la estructura que enviará el proveedor, respetando anidación (ej. `options.temperature` → `payload["options"]["temperature"]`).

Un pequeño helper puede resolver rutas anidadas:

```python
def set_nested(d: dict, path: str, value: Any]) -> None:
    """path = 'options.temperature' -> d['options']['temperature'] = value"""
    keys = path.split(".")
    for key in keys[:-1]:
        d = d.setdefault(key, {})
    d[keys[-1]] = value
```

Así se construye un único `payload` (model, messages, stream, options/…) sin que cada implementación de proveedor tenga que conocer todos los nombres genéricos.

### 3.2 Extensión del protocolo del proveedor

**Opción A (recomendada):** mantener la firma actual y que el **router** construya el payload completo.

- El router (o un módulo `app/llm_payload.py`) construye el diccionario que se envía al proveedor (model, messages, stream, y lo que venga de `model_params` mapeado con `api_key`).
- Cada proveedor recibe un payload “casi final” y lo usa en su HTTP request. Para ello, hay que cambiar la interfaz de `chat_stream` para que acepte **opciones extra** o el payload ya construido.

**Opción B:** extender el protocolo para que cada proveedor reciba “opciones genéricas”.

- En el Protocol: `chat_stream(self, model: str, messages: list[dict], options: dict[str, Any] | None = None)`.
- Cada implementación (Ollama, Mancer) recibe `options` con las claves **genéricas** (temperature, top_p, …) y las traduce internamente a su API. La configuración `api_key` por proveedor podría vivir entonces en el propio proveedor (o en un config que el proveedor lee). La ventaja es que el mapeo está en un solo sitio (config YAML); el router solo pasa `model_params` como `options` y cada proveedor, al construir su payload, consulta el config para saber dónde poner cada clave. Para no duplicar lógica, se puede centralizar el mapeo en un único lugar (p. ej. `provider_params.build_provider_payload(provider_name, model_params) -> dict`) que devuelve el fragmento a fusionar en el payload (ej. `{"options": {"temperature": 0.8}}` para Ollama). El proveedor entonces recibe en `chat_stream` el payload base (model, messages, stream) más ese fragmento, o el router fusiona todo y el proveedor solo recibe el payload final.

Recomendación: **centralizar en el router (o en `llm_payload`) la construcción del payload** usando el YAML:
- Router recibe `model_params`.
- Con `get_params_config(provider)` y `api_key` por cada clave, construye el payload completo (model, messages, stream, options/…) y lo pasa al proveedor.
- Cambiar la firma del proveedor a algo como: `chat_stream(self, model: str, messages: list[dict], extra_body: dict[str, Any] | None = None)` donde `extra_body` es lo que se fusiona en el JSON del POST (para Ollama sería `{"options": {...}}`, para Mancer `{"temperature": ..., "max_tokens": ...}` en el cuerpo raíz). Así el config sigue siendo la única fuente de verdad y los providers no duplican nombres de parámetros.

### 3.3 Ejemplo de fusión en el router

Pseudocódigo:

```python
# En el router, antes de provider.chat_stream(...)
extra_body = {}
if body.model_params and specs:
    for key, value in body.model_params.items():
        if key not in specs:
            continue
        path = specs[key]["api_key"]
        set_nested(extra_body, path, value)

# Llamada
async for chunk in provider.chat_stream(model_id, llm_messages, extra_body=extra_body):
    ...
```

Cada proveedor en su `chat_stream(model, messages, extra_body=None)` hace `payload = {"model": model, "messages": messages, "stream": True}` y si `extra_body` existe hace `payload.update(extra_body)` (o merge profundo si hay anidación). Ollama esperaría por ejemplo `extra_body = {"options": {"temperature": 0.8}}`.

---

## 4. Frontend

### 4.1 Al cambiar de proveedor

1. Llamar a **GET** `/api/providers/{provider}/params`.
2. Para cada parámetro en la respuesta:
   - Mostrar/habilitar el control correspondiente.
   - Inicializar el valor al `default` que devuelve la API (para mostrar en la UI); internamente marcar “no modificado por el usuario”.
3. Para los parámetros que **no** vengan en la respuesta:
   - Ocultar o deshabilitar el control y no enviarlos nunca.

### 4.2 Envío: “solo si el usuario ha cambiado”

- Mantener en estado (p. ej. un objeto) los “defaults” del proveedor actual y los “valores actuales” de cada control.
- En el momento de enviar el mensaje:
  - Construir `model_params = {}`.
  - Para cada parámetro activo (soportado por el proveedor), si `valor_actual !== default`, añadir `model_params[param] = valor_actual`.
  - Enviar en el body `model_params` solo si `Object.keys(model_params).length > 0`; si no, omitir el campo o enviar `{}`.

Así se cumple: “si el usuario no ha cambiado ningún valor, no se envía ese parámetro”.

### 4.3 Persistencia por conversación (opcional)

- Si se desea que al cambiar de conversación se restauren los parámetros que el usuario había puesto en esa conversación, se puede:
  - Guardar en backend `conversation.model_params_snapshot` (JSON) al enviar mensaje o al guardar conversación, y devolverlo en GET conversation; o
  - Guardar en frontend por `conversationId` un mapa de “overrides” y al abrir una conversación cargar esos overrides y usarlos como “valor actual” (y comparar con default para decidir si enviar).
- Fase 1 puede ser: no persistir; los parámetros son “por sesión/UI” y al cambiar de proveedor se resetean a default.

---

## 5. Resumen de flujo

1. **Config:** `provider_params.yaml` (o JSON) define por proveedor qué parámetros existen, su `api_key`, tipo y default.
2. **Backend:** `provider_params.py` carga el config y expone `get_params_config(provider)`. GET `/api/providers/{provider}/params` devuelve eso (solo lo necesario para la UI).
3. **Backend:** En POST messages/stream, se acepta `model_params` opcional. Con el config se mapea cada clave a `api_key` y se construye `extra_body`; se llama a `provider.chat_stream(model, messages, extra_body=extra_body)`.
4. **Proveedores:** `chat_stream` acepta `extra_body` y lo fusiona en el payload que envía por HTTP.
5. **Frontend:** Al cambiar de proveedor, pide params del proveedor, habilita controles y fija defaults; al enviar, solo incluye en `model_params` los parámetros cuyo valor actual ≠ default.

Con esto se cumple: parámetros por proveedor vía archivo de configuración, activación según provider, y envío solo de los que el usuario haya cambiado.
