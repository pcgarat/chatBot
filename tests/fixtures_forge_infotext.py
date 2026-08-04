"""Fixtures de infotext / params.txt inspirados en generaciones reales de Forge Neo."""

SAMPLE_PARAMS_TXT_IMG2IMG = """\
en la foto 1 pon al chico de la foto 2, preserva la composición
Steps: 8, Sampler: Euler, Schedule type: Beta, CFG scale: 1, Seed: 3815280852, Size: 1024x1024, Model: flux2Klein9bFp8_fp8, Model hash: 865ba09f5b, Module 1: Huihui-Qwen3-VL-4B-Instruct-abliterated-fp8_scaled, Module 2: Qwen_Image-VAE, Denoising strength: 1, RNG: CPU, Beta schedule alpha: 0.6, Beta schedule beta: 0.6, Version: neo-2.27
"""

SAMPLE_INFOTEXT_TXT2IMG = """\
a cozy cabin in the snow, cinematic lighting
Negative prompt: blurry, low quality
Steps: 20, Sampler: Euler a, Schedule type: Automatic, CFG scale: 6, Seed: 12345, Size: 832x1216, Model: krea2Turbo_v10, Model hash: abcdef1234, Version: neo-2.27
"""

SAMPLE_PNGINFO_PARAMETERS_IMG2IMG = {
    "Steps": "8",
    "Sampler": "Euler",
    "Schedule type": "Beta",
    "CFG scale": "1",
    "Seed": "3815280852",
    "Size-1": "1024",
    "Size-2": "1024",
    "Model": "flux2Klein9bFp8_fp8",
    "Denoising strength": "1",
    "Prompt": "en la foto 1 pon al chico de la foto 2",
    "Negative prompt": "",
}
