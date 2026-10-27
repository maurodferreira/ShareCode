# Meu PC — espelhamento e controle remoto

## Visualização dentro do ShareCode

A aba **Meu PC** permite que uma pessoa já autenticada no ShareCode visualize imagens periódicas da tela selecionada no PC. **Não é vídeo de baixa latência, Parsec ou controle remoto**; são quadros JPEG leves (~1 quadro/1,6 segundo) enviados apenas enquanto o Chrome/Edge do PC estiver compartilhando com permissão do sistema. A tela precisa estar selecionada no diálogo do navegador. O navegador pode diminuir a frequência em segundo plano.

1. No Windows, acesse ShareCode em `http://127.0.0.1:4177` e abra **Meu PC**.
2. Clique em **Compartilhar minha tela** e selecione **Tela inteira**. A captura é voluntária e pode ser encerrada a qualquer momento.
3. No iPhone com Tailscale ativo e login válido, abra **Meu PC** para visualizar. Toque em **Atualizar imagem** se necessário.
4. De volta ao PC, clique em **Parar compartilhamento** ou use o botão de parar compartilhamento do navegador.

Segurança: transporte pelo HTTPS privado do Tailscale Serve; servidor local somente em `127.0.0.1`; sessão ShareCode obrigatória; token aleatório por transmissão, sem persistência dos JPEGs em disco; quadros expiram em 15 segundos; nenhuma captura automática, gravação, áudio ou controle do teclado/mouse. Todos os dispositivos autenticados na mesma instância ShareCode podem ver a transmissão ativa. Evite deixar credenciais ou documentos sensíveis visíveis durante o compartilhamento.

## Controle total com RustDesk

Para controle real de teclado/mouse, use o aplicativo nativo **RustDesk** para Windows e iOS, separado do ShareCode. Ele oferece controle remoto com melhor latência, gestos e gerenciamento próprio de permissões. Baixe somente de [rustdesk.com](https://rustdesk.com/). Configure autenticação forte e privilégios mínimos.

Se desejar que o acesso direto por IP aconteça **apenas dentro da tailnet Tailscale**, consulte [a documentação sobre direct IP access](https://rustdesk.com/docs/en/self-host/client-configuration/advanced-settings/) e restrinja via firewall do Windows às origens da tailnet (sem abrir portas no roteador). O acesso direto por IP padrão usa a porta 21118, mas a configuração pode variar; não dependa somente do identificador RustDesk como proteção. Não habilite acesso não supervisionado até testar a autenticação e a revogação.

Alternativa: em Windows Pro, [Windows App/RDP pela tailnet](https://tailscale.com/docs/solutions/access-remote-desktops-using-windows-rdp) também dá controle remoto, mas costuma criar/bloquear uma sessão de desktop em vez de espelhar a sessão física como RustDesk.
