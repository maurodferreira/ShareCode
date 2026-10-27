# ShareCode · Anywhere Studio

Painel responsivo e privado para OpenCode **V2** (computador + iPhone), com gerenciamento de sessões e caderno offline. Esta é a **primeira versão funcional (MVP 0.1)**, não uma alternativa completa ao OpenCode. O motor de IA, modelos, ferramentas e arquivos permanecem no OpenCode do computador.

**Status:** interface de sessões e mensagens, criação de sessão, prompts, senha própria, proteção de origem, leitura de projetos, modo offline para rascunhos, backup JSON e editor de arquivos importados com exportação manual. **Ainda não há** sincronização automática de arquivos, agente offline no iPhone, edição direta dos repositórios ou conexão via QR Code neste painel. Consulte [ROADMAP](docs/ROADMAP.md).

## Requisitos

- Windows 10/11, macOS ou Linux; Node.js **22 ou superior**; Git.
- OpenCode **V2** instalado e configurado com um modelo de IA.
- Para acesso privado do iPhone: Tailscale nos dois dispositivos, de preferência com MFA, mais Tailscale Serve/HTTPS.
- O PC deve permanecer ligado e conectado para comandar os agentes remotamente.

Este MVP é **zero-dependency** (sem npm install obrigatório): o backend usa Node.js nativo e o frontend é PWA JavaScript/CSS. Foi escolhido para facilitar instalação e auditoria. Uma migração para React/TypeScript, testes de interface e sincronização de Git está no roadmap.

## Configurar no Windows (PowerShell)

### 1. Baixar o código

```powershell
git clone https://github.com/maurodferreira/ShareCode.git
cd ShareCode
node --version
```

### 2. Manter a MESMA instância OpenCode para o terminal e o iPhone

Se o OpenCode V2 ainda não estiver instalado, siga [instalação oficial](https://opencode.ai/v2/docs/). Configure o **serviço gerenciado**, não uma instância standalone paralela:

```powershell
opencode service set hostname 127.0.0.1
opencode service set port 4096
opencode service set password "SUA_SENHA_FORTE_EXCLUSIVA_DO_OPENCODE"
opencode service start
opencode service status
```

> Escolha uma senha aleatória longa que não use em outros lugares. Evite colocar senhas reais em screenshots, chats ou commits. Para acompanhar a mesma sessão no terminal, execute `opencode` normalmente ou `opencode --server http://127.0.0.1:4096` conforme sua instalação V2. O ShareCode lê o mesmo serviço na porta 4096.

### 3. Configurar ShareCode

```powershell
Copy-Item .env.example .env
notepad .env
```

Preencha a senha **diferente** `SHARECODE_PASSWORD` (mínimo 16 caracteres) e copie a senha do passo 2 para `OPENCODE_SERVER_PASSWORD`. Deixe `SHARECODE_HOST=127.0.0.1`, `SHARECODE_PORT=4177` e `OPENCODE_URL=http://127.0.0.1:4096`.

> O `.env` é ignorado pelo Git. Não cole as senhas nesta conversa. O `start:env` lê o `.env` diretamente no Node 22+.

### 4. Iniciar localmente

```powershell
npm run check
npm run start:env
```

Abra **http://127.0.0.1:4177** no computador e faça login usando `SHARECODE_PASSWORD`. Se aparecer "OpenCode indisponível", confira `opencode service status`, porta e as senhas. O servidor ShareCode deve permanecer aberto no terminal; para uso permanente será necessário configurar uma tarefa de inicialização adequada.

## Conectar seu iPhone ao PC — recomendação: Tailscale Serve

A abordagem de segurança recomendada é uma **tailnet privada**: não encaminhe portas no roteador e não use Tailscale **Funnel** (o Funnel cria acesso público). Não use `SHARECODE_HOST=0.0.0.0` para isso.

1. Instale **Tailscale** no Windows e no iPhone, entre na **mesma conta/tailnet** e habilite MFA no provedor de login. Mantenha as políticas de acesso à tailnet restritas aos seus dispositivos confiáveis.
2. Deixe o ShareCode rodando no PC, localmente na porta 4177.
3. Em outro PowerShell do PC execute:

   ```powershell
   tailscale serve --bg 4177
   tailscale serve status
   ```

   Se a versão instalada não aceitar `--bg`, verifique `tailscale serve --help` e utilize `tailscale serve 4177` enquanto o terminal permanecer aberto. Ative os certificados HTTPS quando o Tailscale solicitar.
4. O comando mostra um endereço HTTPS com domínio `*.ts.net`. Copie **somente a origem** dele, sem barra no final, e adicione no `.env`:

   ```dotenv
   SHARECODE_PUBLIC_ORIGIN=https://seu-pc.sua-tailnet.ts.net
   ```

5. Reinicie o ShareCode (`Ctrl+C`, `npm run start:env`). Abra o endereço HTTPS no Safari do iPhone **com Tailscale conectado** e entre com a senha do ShareCode.
6. No Safari: **Compartilhar → Adicionar à Tela de Início**. Abra o aplicativo ainda com internet para que o Service Worker guarde sua interface para uso offline.

**IMPORTANTE:** a conta/Tailnet restringe quais dispositivos podem chegar ao endereço. O ShareCode ainda exige sua própria senha, e as chamadas internas para OpenCode usam outra senha. O túnel e o acesso dependem do PC ligado. Senhas do OpenCode não são enviadas ao navegador do iPhone.

Para desativar o acesso remoto:

```powershell
tailscale serve reset
```

A configuração de serviço do Tailscale pode variar por versão. Confira a [documentação de Serve](https://tailscale.com/docs/features/tailscale-serve).

## Modo Voo

**iPhone sem internet:** abra a PWA instalada, entre em Modo Voo, escreva rascunhos, importe um arquivo de texto/código localmente e exporte o resultado editado. Os rascunhos são salvos no **IndexedDB do próprio dispositivo**; eles não vão automaticamente para o computador. Faça backup JSON antes de uma viagem importante; o Safari pode eliminar dados de sites sob certas condições. Evite armazenar senhas, tokens ou código sensível no armazenamento offline.

**Notebook sem internet:** rode seu projeto, Git e testes localmente. Para usar IA offline, configure um modelo local compatível com a sua instalação OpenCode (por exemplo via Ollama) antes do voo; o ShareCode não instala modelos por conta própria.

Quando a internet voltar, abra a seção Modo Voo, escolha **Copiar para mensagem**, verifique a sessão destino e clique em Enviar. Nada é disparado automaticamente. Arquivos exportados devem ser revisados/aplicados manualmente no repositório correspondente.

## Segurança

Leia [SECURITY.md](docs/SECURITY.md) **antes** de ativar qualquer acesso remoto. Resumidamente: senha forte e exclusiva em ambas as camadas, HTTPS, tailnet restrita, PC atualizado, permissões sensíveis no OpenCode e nenhuma porta pública. Para Cloudflare Zero Trust, consulte a seção de arquitetura; a integração Cloudflare não vem configurada no MVP.

## Comandos

```powershell
npm run start:env  # Com .env
npm run dev:env    # Node watch, desenvolvimento
npm run check      # Syntax check + testes
npm test           # Testes de autenticação e API
```

## Licença e créditos

O código do ShareCode é disponibilizado sob licença MIT (veja [LICENSE](LICENSE)). OpenCode e [opencode-zero-trust](https://github.com/arthurfiorette/opencode-zero-trust) são projetos independentes e **não foram copiados nem incluídos como submódulos**. O ShareCode consome a API HTTP oficial do OpenCode V2.
