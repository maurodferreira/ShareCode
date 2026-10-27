# Roadmap — ShareCode

## v0.1 — base executável (implementada no repositório)

- [x] Painel mobile/desktop, autenticação e logout
- [x] Proxy local com rotas permitidas da API OpenCode V2
- [x] Listar/criar sessões, consultar histórico textual, enviar prompts
- [x] PWA de shell offline e armazenamento de rascunhos em IndexedDB
- [x] Editor de arquivo de texto importado/exportado manualmente
- [x] Script de início no Windows, documentação Tailscale Serve e segurança
- [x] Testes automatizados de autenticação e rotas com OpenCode simulado

## v0.2 — integração real testada em hardware

- [ ] Testar no Windows com OpenCode V2 instalado e ao menos um modelo configurado
- [ ] Verificar campos reais de sessões/mensagens nos projetos existentes
- [ ] UX para permissões pendentes e formulário de aprovação
- [ ] Persistência de seleção de sessão e paginação
- [ ] CI (GitHub Actions) e testes de interface no Safari/iOS
- [ ] Instalação automatizada orientada, sem armazenar segredos no Git

## v0.3 — sincronização controlada

- [ ] Snapshot de arquivos selecionados explicitamente por pasta e extensão
- [ ] Metadados Git: SHA base, hash de arquivo, versões de destino
- [ ] Comparação lado a lado e confirmação de mudanças
- [ ] Importação/exportação com criptografia local opcional
- [ ] Resolução de conflitos (3-way merge), idempotência e logs de sincronização
- [ ] Testes de rede interrompida e dispositivos simultâneos

## v0.4 — experiência avançada

- [ ] React + TypeScript / editor CodeMirror e testes e2e
- [ ] Agentes especializados configuráveis e fila de aprovação
- [ ] GitHub Hub, commits, branches, PRs em fluxo supervisionado
- [ ] Políticas de acesso por dispositivo e revogação/auditoria
- [ ] Plugin complementar para integração Cloudflare Zero Trust

## Limitações de ambiente

- Não é possível executar agentes OpenCode remotamente se o PC estiver desligado ou sem internet.
- No iPhone offline não há execução de modelos que dependam de rede. Para notebook offline considere modelos locais antes de viajar.
- O browser iOS pode eliminar dados persistidos; exportação e backup continuam necessários.
- O projeto não deve ser exposto publicamente antes da revisão de segurança.
