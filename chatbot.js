// Leitor de QR Code / sessão
const qrcode = require('qrcode-terminal');
const { Client, Buttons, List, MessageMedia, LocalAuth } = require('whatsapp-web.js');

const client = new Client({
  authStrategy: new LocalAuth(), // mantém a sessão salva
  puppeteer: { headless: true, args: ['--no-sandbox'] }
});

// QR
client.on('qr', (qr) => qrcode.generate(qr, { small: true }));

// Ready
client.on('ready', () => {
  console.log('Tudo certo! WhatsApp conectado (Madala CF).');
});

// Inicializa
client.initialize();

// Utils
const delay = (ms) => new Promise((res) => setTimeout(res, ms));
const typing = async (chat, ms = 1200) => { await chat.sendStateTyping(); await delay(ms); };

// Texto do menu principal
const menuText = (nome = '') => 
`Olá ${nome ? nome.split(' ')[0] : ''}! 👋\n

Bem vinda a família *Madala CF*💪 Com 10 anos de mercado, somos profissionais no compromisso que assumimos com você!
Sua saúde e bem estar é a nossa prioridade.\n

Escolha uma opção para descobri mais sobre a *Madala CF* (envie o número):

1 - 🏋️ Como funcionam as aulas de CrossFit
2 - 🥋 Aulas de judo com Sensei Jeferson todos os dias.
3 - 🌐 Redes sociais Madala CF
4 - 🏆 Eentos Madala CF
0 - ☎ Falar com Tchê (gerente geral)
`;

// Remova a linha com erro e use esta estrutura
function menu_rápido(nome = '') {
    return `Olá ${nome ? nome.split(' ')[0] : ''}! 👋\n
    Escolha uma opção para descobri mais sobre a *Madala CF* (envie o número):

    1 - 🏋️ Como funcionam as aulas de CrossFit
    2 - 🥋 Aulas de judo com Sensei Jeferson todos os dias.
    3 - 🌐 Redes sociais Madala CF
    4 - 🏆 Eentos Madala CF
    0 - ☎ Falar com Tchê (gerente geral)"`;
}

// Respostas
const RESPOSTAS = {
  comoFunciona: 
`*COMO FUNCIONA O CROSSFIT?*
• Treinos em grupo com coach supervisionando (todos os níveis).
• Aula com aquecimento, técnica.
• Escalas: Iniciante, Intermediário e Avançado.
• Avaliação inicial para ajustar cargas e movimentos.
• Abrimos de Seg a Sáb. das 6h às 21h.

Localização: https://maps.app.goo.gl/nyDBAPzNLLBHYWMJ9\n'+

Bora fazer uma aula teste? 💪

✅Agente sua aula experimental:
https://calendar.app.google/9r6mFZTPwUivm4x89`
    + '\n\n' +
' 1 - Para mais informações',

  planos:
`*PLANOS E VALORES*
Planos do CrossFit (premium):\n
💰 Trimestral: R$ 510/mês\n
💰 Semestral: R$ 440/mês\n
💰 Anual: R$ 360/mês\n\n

Pagamento: Cartão, PIX, boleto.\n
1 para marcar aula experimental (grátis).`,


  Modalidade_judo:
`Judô 🥋 todos os dias às 21h (1h). Instrutor: *Sensei Jeferson* ` +
`Mensalidade: R$ 150,00, ` +
'Quer agendar uma aula experimental?\n' +
'Acesse o link de agendamento: https://calendar.google.com/calendar/u/0/r/month/2025/9/24' +

'1 Voltar ao menu principal\n' +
'2 Estrutura da academia Crossfit Madala CF\n' +
'4 Fala diretamente com instrutor de Judô\n' +``,

  Eventos_madalacf:
`*PROMOÇÕES ATIVAS* (exemplo — ajuste)
Acesse nosso calendário de eventos e fique por dentro de tudo o que rola na Madala CF:\n +
` +
`https://calendar.google.com/calendar/u/0/r/month/2024/6/1`,

  atendente:
`Este é o contato do Tchê. 👩‍💻
Seu genrente geral, pronto para te ajudar com qualquer dúvida ou suporte que precisar.\n +

Contato Madala CF - Tchê
https://wa.me/qr/LI5TG3DW5XAZF1 

Envie um minuto para retorno.`,

 menu_rápido:
` Escolha uma opção para descobri mais sobre a *Madala CF* (envie o número):

1 - 🏋️ Como funcionam as aulas de CrossFit
2 - 🥋 Aulas de judo com Sensei Jeferson todos os dias.
3 - 🌐 Redes sociais Madala CF
4 - 🏆 Eentos Madala CF
0 - ☎ Falar com Tchê (gerente geral)`,

Redes_sociais:
`*REDES SOCIAIS MADALA CF* 📱\n
Siga a gente nas redes sociais e fique por dentro de todas as novidades, dicas de treino e muito mais!\n
📸Instagram: https://www.instagram.com/madalacf/\n
👍Facebook: https://www.facebook.com/madalacf\n
▶️ YouTube: https://www.youtube.com/@madalacf\n
🌐 Site: https://madalacf.com.br\n`,
};

// Helper para enviar o MENU com botões
async function enviarMenu(msg, chat, nome) {
  const botoes = new Buttons(
    'Escolha abaixo ou digite o número correspondente:',
    [
      { body: '1 - 🏋️ Como funcionam as aulas de CrossFit' },
      { body: '2 - 🥋 Aulas de judo com Sensei Jeferson todos os dias.' },
      { body: '3 - 🌐 Redes sociais Madala CF' },
      { body: '4 - 🏆 Eentos Madala CF' },
      { body: '0 - ☎ Falar com Tchê (gerente geral)' }
    ],
    'Madala CF',
    'Você também pode digitar: menu, voltar'
  );
  await typing(chat);
  await client.sendMessage(msg.from, menuText(nome));
  await delay(400);
  await client.sendMessage(msg.from, botoes);
}

// Router principal
client.on('message', async (msg) => {
  try {
    // Ignora grupos e status
    if (!msg.from.endsWith('@c.us')) return;

    const chat = await msg.getChat();
    const contact = await msg.getContact();
    const nome = contact.pushname || '';

    // Normaliza entrada
    const texto = (msg.body || '').toString().trim();
    const lower = texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

    // Saudações / abertura de funil
    const ehSaudacao = /(Oi|olá|ola|olaa|hey|eai|e aí|tudo bem|fala|alô|boa|opa|salve|fala aí|tudo certo|e aí| como vai|oi| tudo bem|alô| oi|firmeza|oi| como posso ajudar|olá| bem-vindo|saudações|oi| por favor|diga|oi| o que deseja|olá| bom dia|olá| boa tarde|olá| boa noite|bem-vindo|oi| à disposição|oi| como está|olá| fala|oi| o que manda|e aí| beleza|qual é|e aí| meu chapa|fala| irmão|e aí| meu querido|oi| meu nome é...)/i.test(lower);
    const ehMenu = ehSaudacao || lower === 'voltar' || lower === 'inicio' || lower === 'start';

    if (ehMenu) {
      await enviarMenu(msg, chat, nome);
      return;
    }

    // Ações por opção numérica
    switch (lower) {
      case '1':
      case '1 - 🏋️ - Como funcionam as aulas de CrossFit':
        await typing(chat);
        await client.sendMessage(msg.from, RESPOSTAS.comoFunciona);
        await client.sendMessage(msg.from, menu_rápido(nome));
        break;

      case '2':
      case '2 - 🥋 Aulas de judo com Sensei Jeferson todos os dias.':
        await typing(chat);
        await client.sendMessage(msg.from, RESPOSTAS.Modalidade_judo);
        await client.sendMessage(msg.from, menu_rápido(nome));
        break;

      case '3':
      case '3 - 🌐 Redes sociais Madala CF':
      case '3 - 🌐 Redes sociais Madala CF':
        await typing(chat);
        await client.sendMessage(msg.from, RESPOSTAS.Redes_sociais);
        await client.sendMessage(msg.from, menu_rápido(nome));
        break;

      case '4':
      case '4 - 🏆 Eentos Madala CF':
      case '4 - 🏆 Eentos Madala CF':
        await typing(chat);
        await client.sendMessage(msg.from, RESPOSTAS.Eventos_madalacf);
        await client.sendMessage(msg.from, menu_rápido(nome));
        break;

      case '0':
      case '0 - ☎ Falar com Tchê (gerente geral)':
        await typing(chat);
        await client.sendMessage(msg.from, RESPOSTAS.atendente);
        await client.sendMessage(msg.from, menu_rápido(nome));
        break;
        default:
        // Fallback inteligente: se a pessoa digitou texto livre, ofereça ajuda e menu
        await typing(chat);
                await client.sendMessage(
                  msg.from,
                  'Não entendi bem sua mensagem. 😊\nEnvie um *número* do menu ou digite *0* para falar com um atendente.'
                );
            }
          } catch (err) {
            console.error('Erro no processamento da mensagem:', err);
          }
        });
import express from "express";

// health-check server
const app = express();
app.get("/", (req, res) => res.send("🤖 Chatbot online!"));
app.listen(3000, () => console.log("Servidor de health-check rodando na porta 3000"));
