# ShareCode — Arquitetura 0.1

```text
Safari no iPhone — HTTPS (Tailscale Serve, acesso privado)
         |
         v
Node HTTP (127.0.0.1:4177) — ShareCode
  ├─ senha própria, sessões HTTP-only, SameSite Strict
  ├─ validação de Origin + allowlist de rotas
  ├─ assets PWA (nunca guarda credenciais ou dados da API no SW)
  └─ HTTP Basic autenticado (lado servidor apenas)
         |
         v
OpenCode V2 (127.0.0.1:4096) — instância gerenciada
  ├─ sessões, agentes, modelos, plugins
  └─ ferramentas do usuário local
```

A interface do ShareCode tem seu próprio ciclo de login e cache de shell; o estado das sessões continua no OpenCode. Para manter a mesma sessão no desktop e iPhone, não execute uma segunda instância standalone `opencode serve` para um projeto diferente; a configuração usa um serviço compartilhado (`opencode service`).

### API explícita no ShareCode

| Método | Caminho | Comportamento |
|---|---|---|
| GET | `/api/auth/status` | Verifica cookie |
| POST | `/api/auth/login` | Login + limite de tentativas |
| POST | `/api/auth/logout` | Revoga cookie |
| GET | `/api/system/status` | Verifica `/api/info` |
| GET | `/api/projects` | Lista `/api/project` |
| GET | `/api/sessions` | Lista `/api/session` |
| POST | `/api/sessions` | Cria sessão |
| GET | `/api/sessions/:id/messages` | Lista mensagens |
| POST | `/api/sessions/:id/prompt` | Agenda instrução da IA |

Não há proxy HTTP genérico de qualquer rota: as capacidades expostas ao celular são limitadas. O backend usa `fetch` com timeout, impede redirecionamentos e exige OpenCode em loopback para evitar conexões a servidores remotos não confiáveis.

### Estrutura de arquivos

- `server/` servidor Node e regras de autenticação, proxy HTTP com allowlist.
- `public/` app PWA mobile/desktop sem dependências, estilização e service worker.
- `tests/` testes de autenticação e integração com OpenCode simulado.
- `docs/` arquitetura, segurança e roadmap.

### Offline

O service worker armazena **apenas** HTML/CSS/JS/manifesto estáticos. Rascunhos textuais ficam em IndexedDB sem sincronização automática. O editor aceita arquivos selecionados explicitamente no iPhone e gera um download manual. O modo offline é um caderno e editor portátil, não um motor remoto de execução.

### Por que não integrar já o Zero Trust do Arthur?

O `opencode-zero-trust` gerencia o túnel da **instância OpenCode**, não do ShareCode. Criar outra rota no mesmo túnel de maneira não suportada poderia interferir com seu ciclo de vida e com o controle de origem. Na primeira versão, o acesso privado ao painel é via Tailscale Serve, sem domínio próprio ou porta pública. Para integração Cloudflare futura, será necessário um túnel e aplicação Access separados para o ShareCode, testando JWT de Access e sessões.
