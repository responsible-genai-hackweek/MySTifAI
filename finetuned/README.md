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

Run the new model
```
ollama run qwen3-64k
```

### Test raw responses

```
curl http://localhost:11434/api/tags
curl http://localhost:11434/api/generate -d '{"model":"qwen3-64k","prompt":"hello"}'
```

### Add Ollama to OpenCode

install opecode.json to ~/.config/opencode/opencode.json