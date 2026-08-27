

## Findings

### CPU vs GPU Inference

* Ran on a t4g.2xlarge (8 vCPU, 32GB RAM) system and a simple prompt `Talk like a pirate` took over 8 minutes to execute.  At $0.2688 / hour to execute, this costed $0.035 for the response.

* Ran on a g4dn.xlarge (2 vCPU, T4 GPU / 16GB) system and a simple prompt `Talk like a pirate` took just over 3 seconds to execute.  At $0.526 / hour to execute, this costed $0.00044 for the repsonse.

### Unskilled Generic Request

session-ses_fba9.md


## Instance Setup

### Install OpenCode

```
curl -fsSL https://opencode.ai/install | bash
```

### Install Ollama

```
curl -fsSL https://ollama.com/install.sh | sh
ollama --version
```

### Download model

```
ollama pull qwen3:8b
ollama list
```

### Configure and Run Ollama

Create a new model with a 64k context window
```
ollama create qwen3-64k -f ./Modelfile
ollama show --modelfile qwen3-64k
```

### Add Ollama to OpenCode

install opecode.json to ~/.config/opencode/opencode.json

### (Optional) Test raw responses

Run the new model interactively
```
ollama run qwen3-64k
```

Hit the local API
```
curl http://localhost:11434/api/tags
curl http://localhost:11434/api/generate -d '{"model":"qwen3-64k","prompt":"hello"}'
```
