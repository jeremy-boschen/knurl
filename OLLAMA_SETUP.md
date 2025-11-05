# Ollama Setup for Feature Manifest Generator

This document describes how to configure Ollama for the Feature Manifest Generator, which requires `qwen2.5-coder:7b` with extended context support.

## Quick Start

1. **Install Ollama**
   - Download from [ollama.ai](https://ollama.ai)
   - Ensure version 0.1.16+ for best compatibility

2. **Pull the Model**
   ```bash
   ollama pull qwen2.5-coder:7b
   ```

3. **Configure Extended Context (Optional but Recommended)**

   By default, qwen2.5-coder-7b uses 32K tokens. For the feature manifest generator to process large codebases efficiently, enable YaRN (length extrapolation):

   **Linux/macOS:**
   ```bash
   # Create/edit ~/.ollama/models/modelfile-qwen
   FROM qwen2.5-coder:7b

   PARAMETER rope_scaling_type yarn
   PARAMETER rope_scaling_factor 4.0

   # Create extended model
   ollama create qwen2.5-coder:extended -f ~/.ollama/models/modelfile-qwen
   ```

   **Windows (PowerShell):**
   ```powershell
   # Create file at %APPDATA%\ollama\models\modelfile-qwen
   FROM qwen2.5-coder:7b

   PARAMETER rope_scaling_type yarn
   PARAMETER rope_scaling_factor 4.0

   # Create extended model
   ollama create qwen2.5-coder:extended -f $env:APPDATA\ollama\models\modelfile-qwen
   ```

4. **Start Ollama**
   ```bash
   # Linux/macOS
   ollama serve

   # Windows
   # Start from taskbar or: ollama serve
   ```

5. **Verify Setup**
   ```bash
   # Check available models
   curl http://host.docker.internal:11434/api/tags

   # Check loaded models
   curl http://host.docker.internal:11434/api/ps
   ```

## Context Window Configuration

### Default Behavior
- **Context Size:** 32K tokens
- **Suitable for:** Small to medium codebases (< 50 files per area)
- **Suitable for:** Development and testing

### Extended Context (Recommended)
- **Context Size:** Up to 131K tokens with YaRN enabled
- **Suitable for:** Full codebase analysis
- **Recommended for:** Production feature manifest generation

To use extended context, configure YaRN as described above.

## Memory Management

### Keeping Model Loaded
By default, Ollama unloads models after inactivity to free memory. To keep qwen2.5-coder loaded:

**Option 1: Environment Variable (Simple)**
```bash
export OLLAMA_KEEP_ALIVE=-1     # Never unload
export OLLAMA_KEEP_ALIVE=24h    # Keep for 24 hours
```

**Option 2: Ollama Settings**
Edit Ollama settings to increase `keep_alive` parameter.

### System Requirements
- **GPU Memory:** 6-8GB (7B model fits on most modern GPUs)
- **RAM:** 16GB+ recommended
- **Disk:** ~15GB for model weights

## Troubleshooting

### Model Not Responding
```bash
# Restart Ollama service
# Check: curl http://host.docker.internal:11434/api/tags

# On Windows (from PowerShell)
$env:OLLAMA_HOST = "127.0.0.1:11434"
```

### Context Window Errors
If you see "context length exceeded" errors:
1. Verify YaRN configuration: `ollama list`
2. Increase `MAX_CONTEXT_TOKENS` in `scripts/feature-manifest.mjs`
3. Reduce file size: `MAX_FILE_CHARS = 3000`

### Performance Issues
- Check GPU utilization: `nvidia-smi` (NVIDIA) or `radeontop` (AMD)
- Reduce `--max-files` flag when running generator
- Use `--dry-run` first to estimate impact

## Integration with Feature Manifest Generator

The script automatically:
- Uses `qwen2.5-coder:7b` by default
- Connects to `http://host.docker.internal:11434`
- Respects context window limits (120K tokens conservative)
- Handles errors gracefully if model is unavailable

To use a different model:
```bash
yarn feature-manifest --model mistral:7b
```

## Production Recommendations

1. **Dedicated Ollama Instance**
   - Run Ollama on stable server/machine
   - Keep process alive: `systemd` service or equivalent

2. **Model Configuration**
   - Enable YaRN for extended context
   - Set `OLLAMA_KEEP_ALIVE` to appropriate value
   - Allocate sufficient GPU memory

3. **Monitoring**
   - Check `/api/ps` endpoint periodically
   - Monitor disk space (model weights)
   - Track GPU memory usage

4. **CI/CD Integration**
   - Use Docker container with Ollama pre-loaded
   - Or run as separate service with health checks
   - Set environment variables before feature-manifest runs

## References

- Ollama Documentation: https://github.com/ollama/ollama
- Qwen2.5-Coder Model: https://huggingface.co/Qwen/Qwen2.5-Coder-7B
- YaRN Technique: https://arxiv.org/abs/2309.00071
