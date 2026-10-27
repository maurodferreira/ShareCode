# Segurança — leitura obrigatória

ShareCode controla sessões de um sistema capaz de executar ferramentas **com permissões do usuário do computador**. Ameaças: acesso não autorizado, sessões roubadas, phishing de QR/pairing, senhas reutilizadas, execução acidental de prompts, comprometimento de aparelho e vazamento de rascunhos offline.

## Modelo de defesa

1. **Rede:** ShareCode escuta somente `127.0.0.1`. Use exclusivamente `tailscale serve` (rede privada) como primeira opção. **Nunca** abra 4177/4096 em roteador, Tailscale Funnel ou um túnel público sem um desenho adicional de segurança e auditoria.
2. **Autenticação:** o ShareCode tem senha própria >=16 caracteres, validada por scrypt, com limite de 5 tentativas por IP a cada 15 min. Token de sessão aleatório com 256 bits, em cookie HttpOnly, SameSite Strict, expiração 12h; `Secure` quando há `SHARECODE_PUBLIC_ORIGIN` HTTPS. Sessões são **somente em memória** e revogadas ao reiniciar.
3. **OpenCode:** configure outra senha exclusiva. A credencial OpenCode fica só no backend. Habilite prompts de permissão nas ferramentas do OpenCode. Não ative modos indiscriminados de autoaprovação.
4. **HTTP:** POSTs exigem `Origin` local ou o `SHARECODE_PUBLIC_ORIGIN` exato; resposta CSP, `X-Frame-Options: DENY`, `nosniff`, no-store; hosts desconhecidos recusados. O servidor não disponibiliza endpoints arbitrários do OpenCode.
5. **Privacidade:** service worker armazena somente a aplicação; mensagens do servidor não são cacheadas. Rascunhos offline ficam no IndexedDB sem criptografia de aplicação. Não salve segredos, PII ou código confidencial nesta fila.
6. **Confirmação:** o app jamais envia automaticamente rascunhos após o retorno da conexão; arquivos locais não sofrem alterações remotas silenciosas.
7. **Dispositivo:** proteja iPhone e PC com desbloqueio, MFA para Tailscale/GitHub e atualizações regulares.

## Limites conhecidos

- Ainda não há cadastro/revogação individual de dispositivos no ShareCode, MFA nativo ou auditoria persistente. A camada de dispositivo é gerida pela tailnet.
- O bloqueio de login usa IP e é armazenado em memória; um proxy compartilhado pode afetar várias pessoas. O Tailnet restrito é a camada primordial.
- A sessão do ShareCode pode ser controlada por qualquer processo/usuário que tenha acesso ao navegador desbloqueado; evite aparelhos compartilhados.
- O editor offline não armazena automaticamente alterações antes da exportação; exporte manualmente para não perder trabalho.
- Nunca confunda "OpenCode online" com "execução de IA 100% segura"; os agentes ainda podem propor ações arriscadas.
- O projeto ainda requer auditoria de segurança independente antes de receber dados de clientes ou exposição pública.

## Se suspeitar de invasão

1. Desconecte o acesso remoto com `tailscale serve reset`.
2. Pare ShareCode e OpenCode.
3. Revogue o dispositivo na tailnet e troque senhas de ShareCode/OpenCode.
4. Analise alterações no repositório e atividade do sistema antes de reativar.

## Informações do projeto

Não inclua `.env`, tokens, credenciais, logs sensíveis ou imagens de QR de pareamento no GitHub. O arquivo `.env` é ignorado no `.gitignore`.
