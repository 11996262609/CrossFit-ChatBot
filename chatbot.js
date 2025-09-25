const { Client, LocalAuth, List } = require('whatsapp-web.js');
const path = require('path');
const fs = require('fs');

// (opcional) limpeza preventiva de locks do chromium
(function clearChromeSingletonLocks() {
  try {
    const home = process.env.HOME || '/root';
    const chromeCfg = path.join(home, '.config', 'chromium');
    ['SingletonLock', 'SingletonCookie', 'SingletonSocket'].forEach(f => {
      const p = path.join(chromeCfg, f);
      if (fs.existsSync(p)) fs.rmSync(p, { force: true });
    });
    console.log('[Chromium] Locks limpos (se existiam).');
  } catch (e) {
    console.warn('[Chromium] Falha ao limpar locks:', e.message);
  }
})();

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }), // persiste no volume
  // DÊ UM PERFIL VOLÁTIL AO CHROMIUM (não é o da sessão do WhatsApp)
  puppeteer: {
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
    userDataDir: '/tmp/chromium-profile', // perfil isolado e descartável
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-zygote',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-features=TranslateUI'
    ],
    timeout: 90000
  }
});


// eventos úteis
client.on('qr', (qr) => {
  const qrcode = require('qrcode-terminal');
  qrcode.generate(qr, { small: true });
});
client.on('ready', () => console.log('Tudo certo! WhatsApp conectado (Madala CF).'));

// inicializa
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

function menu_rápido(nome = '') {
  return ` ${nome ? nome.split(' ')[0] : ''}! 👋

Escolha uma opção para descobrir mais sobre a *Madala CF* (envie o número):

1 - 🏋️ Como funcionam as aulas de CrossFit
2 - 🥋 Aulas de judô com Sensei Jeferson todos os dias.
3 - 🌐 Redes sociais Madala CF
4 - 🏆 Eventos Madala CF
0 - ☎ Falar com Tchê (gerente geral)`;
}

function opção(nome = '') {
  return ` ${nome ? nome.split(' ')[0] : ''}! 👋

Mais - 📊 Para mais informações sobre planos e valores
Volta - 🔙 Voltar ao menu inicial
Atendente - ☎ Falar com um atendente`;
}

function marcar(nome = '') {
  return ` ${nome ? nome.split(' ')[0] : ''}! 👋

Marcar - 📊 Para agendar uma aula esperimental
Menu - 🔙 Voltar ao menu inicial
Gerente - ☎ Falar com um atendente`;
}

function planos_valores(nome = '') {
    return `Aqui ${nome ? nome.split(' ')[0] : ''}! 👋\n

      *PLANOS E VALORES*
    Planos do CrossFit (premium):\n
   💰 Trimestral: R$ 510/mês\n
   💰 Semestral: R$ 440/mês\n
   💰 Anual: R$ 360/mês\n\n

Pagamento: Cartão crédito/Débito, PIX.\n`;
}


function cfPosMenu(nome='') {
  const first = nome ? nome.split(' ')[0] : '';
  return `${first ? first + ', ' : ''}escolha uma opção (digite a palavra):

• *Mais*  → 📊 Planos e valores
• *Marcar* → 🗓️ Agendar aula experimental
• *Menu*  → 🔙 Voltar ao menu inicial
• *Sair*  → ❌ Encerrar`;
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
'',

  planos:
`*PLANOS E VALORES*
Planos do CrossFit (premium):\n
💰 Trimestral: R$ 510/mês\n
💰 Semestral: R$ 440/mês\n
💰 Anual: R$ 360/mês\n\n

Pagamento: Cartão, PIX, boleto.\n

✅Agente sua aula experimental:
https://calendar.app.google/9r6mFZTPwUivm4x89`,


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

Redes_sociais:
`*REDES SOCIAIS MADALA CF* 📱\n
Siga a gente nas redes sociais e fique por dentro de todas as novidades, dicas de treino e muito mais!\n
📸Instagram: https://www.instagram.com/madalacf/\n
👍Facebook: https://www.facebook.com/madalacf\n
▶️ YouTube: https://www.youtube.com/@madalacf\n
🌐 Site: https://madalacf.com.br\n`,


};

// Helper para enviar o MENU com botões
// ===================== HELPERS / ESTADO =====================
const estado = {}; // { [chatId]: 'MAIN' | 'CF_MENU' }



const firstName = v => (v ? String(v).trim().split(/\s+/)[0] : '');

// Card pós-Menu do CrossFit (texto-livre: Mais/Marcar/Menu/Sair)
function cfPosMenu(nome='') {
  const n = firstName(nome);
  return `${n ? n + ', ' : ''}escolha uma opção (digite a palavra):
• *Mais*   → 📊 Planos e valores
• *Marcar* → 🗓️ Agendar aula experimental
• *Menu*   → 🔙 Voltar ao menu inicial
• *Sair*   → ❌ Encerrar`;
}


// ===================== MENU (LIST) ATUALIZADO =====================
// Envia APENAS o List (sem duplicar com texto separado)
async function enviarMenu(msg, chat, nome) {
  const first = v => (v ? String(v).trim().split(/\s+/)[0] : '');

  const textoFallback = `Olá ${first(nome)}! 👋

Bem-vinda à família *Madala CF* 💪
Escolha uma opção (responda com o número):
1 - 🏋️ Como funcionam as aulas de CrossFit
2 - 🥋 Aulas de judô com Sensei Jeferson todos os dias.
3 - 🌐 Redes sociais Madala CF
4 - 🏆 Eventos Madala CF
0 - ☎ Falar com Tchê (gerente geral)`;

  await typing(chat);
  // 1) Sempre envia o fallback (garante funcionamento no Web/Desktop)
  await client.sendMessage(msg.from, textoFallback);

  // 2) Tenta enviar o List (aparece bem no celular)
  try {
    const body = `Toque em "Ver opções" no celular para abrir a lista.`;
    const sections = [{
      title: 'Menu principal',
      rows: [
        { id: '1', title: '1 - 🏋️ Como funcionam as aulas de CrossFit' },
        { id: '2', title: '2 - 🥋 Aulas de judô com Sensei Jeferson todos os dias.' },
        { id: '3', title: '3 - 🌐 Redes sociais Madala CF' },
        { id: '4', title: '4 - 🏆 Eventos Madala CF' },
        { id: '0', title: '0 - ☎ Falar com Tchê (gerente geral)' },
      ],
    }];
    const list = new List(body, 'Ver opções', sections, 'Madala CF', 'Se preferir, digite o número.');
    await client.sendMessage(msg.from, list);
  } catch (e) {
    // Se o List não renderizar no dispositivo (ex.: Web), ignore:
    console.warn('List não enviado (usando só fallback).', e?.message || e);
  }
}
// ===================== ROUTER PRINCIPAL (UM ÚNICO LISTENER) =====================
client.on('message', async (msg) => {
  try {
    // Ignora grupos/status
    if (!msg.from.endsWith('@c.us')) return;

    const chat    = await msg.getChat();
    const contact = await msg.getContact();
    const nome    = contact.pushname || contact.name || contact.shortName || contact.number || '';
    const chatId  = msg.from;

    // Normalização
    const rawText   = (msg.body || '').toString().trim();
    const lowerText = rawText.toLowerCase();
    let   asciiText = lowerText.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Se a mensagem for resposta de List, use o id da linha para rotear (fica '1','2','3','4','0')
    if (msg.type === 'list_response' && msg.selectedRowId) {
      asciiText = String(msg.selectedRowId).trim().toLowerCase();
    }

    // Gatilho de saudação/menu → abre o menu inicial (List)
    const ehSaudacao = /(menu|dia|tarde|noite|oi|ola|olá|oie|hey|eai)/i.test(asciiText);
    if (ehSaudacao) {
      estado[chatId] = 'MAIN';          // reseta estado
      await enviarMenu(msg, chat, nome);
      return;
    }

    // Estado atual
    const st = estado[chatId] || 'MAIN';

    // ==================== MAIN (menu principal) ====================
    if (st === 'MAIN') {
      // 1) CrossFit → envia "Como funciona" e o pós-menu CF
      if (asciiText === '1' || lowerText.startsWith('1 - 🏋️')) {
        await typing(chat);
        await client.sendMessage(chatId, RESPOSTAS.comoFunciona); // seu card "como funciona"
        await client.sendMessage(chatId, cfPosMenu(nome));        // pós-menu CF (Mais/Marcar/Menu/Sair)
        estado[chatId] = 'CF_MENU';
        return;
      }

      // 2) Judô
      if (asciiText === '2' || lowerText.startsWith('2 - 🥋')) {
        await typing(chat);
        await client.sendMessage(chatId, RESPOSTAS.Modalidade_judo);
        await enviarMenu(msg, chat, nome); // reabre o menu principal após card
        return;
      }

      // 3) Redes sociais
      if (asciiText === '3' || lowerText.startsWith('3 - 🌐')) {
        await typing(chat);
        await client.sendMessage(chatId, RESPOSTAS.Redes_sociais);
        await enviarMenu(msg, chat, nome);
        return;
      }

      // 4) Eventos
      if (asciiText === '4' || lowerText.startsWith('4 - 🏆')) {
        await typing(chat);
        await client.sendMessage(chatId, RESPOSTAS.Eventos_madalacf);
        await enviarMenu(msg, chat, nome);
        return;
      }

      // 0) Atendente
      if (asciiText === '0' || lowerText.startsWith('0 - ☎')) {
        await typing(chat);
        await client.sendMessage(chatId, RESPOSTAS.atendente);
        await enviarMenu(msg, chat, nome);
        return;
      }

      // Fallback no MAIN
      await typing(chat);
      await client.sendMessage(chatId, 'Não entendi. Toque em "Ver opções" ou digite *menu* para abrir o menu.');
      await enviarMenu(msg, chat, nome);
      return;
    }

    // ==================== CF_MENU (pós-menu do CrossFit) ====================
    if (st === 'CF_MENU') {
      // "mais" → planos
      if (asciiText === 'mais' || asciiText === 'planos' || asciiText === 'valores' || asciiText === 'precos' || asciiText === 'preços' || asciiText === 'Mais' || asciiText === 'Planos' || asciiText === 'Valores' || asciiText === 'Precos' || asciiText === 'Preços') {
        await typing(chat);
        await client.sendMessage(chatId, RESPOSTAS.planos); // ou planos_valores(nome)
        await client.sendMessage(chatId, cfPosMenu(nome));  // permanece no CF_MENU
        return;
      }

      // "marcar" → link de agendamento (defina RESPOSTAS.agendarCrossfit)
      if (asciiText === 'marcar' || asciiText === 'agendar' || asciiText === 'agendamento' || asciiText === 'Marcar' || asciiText === 'Agendar' || asciiText === 'Agendamento') {
        await typing(chat);
        await client.sendMessage(chatId, RESPOSTAS.agendarCrossfit);
        await client.sendMessage(chatId,comoFunciona(nome));
        return;
      }

      // "menu"/"inicio" → volta ao menu inicial
      if (['menu','inicio','início'].includes(asciiText)) {
        estado[chatId] = 'MAIN';
        await enviarMenu(msg, chat, nome);
        return;
      }

      // "sair" → encerra (reseta estado)
      if (asciiText === 'sair') {
        await client.sendMessage(chatId, 'Até logo! 👋');
        estado[chatId] = 'MAIN';
        return;
      }

      // Inválido no CF_MENU → reexibe instruções
      await client.sendMessage(chatId, cfPosMenu(nome));
      return;
    }

  } catch (err) {
    console.error('Erro no processamento da mensagem:', err);
  }
});


// Servidor simples para manter o bot ativo (útil em plataformas como Heroku)
// health-check server
const express = require('express');
const app = express();
app.get('/', (_req, res) => res.send('🤖 Chatbot online!'));
app.listen(3000, () => console.log('Health-check na porta 3000'));
module.exports = app;

process.on('unhandledRejection', (e) => console.error('UnhandledRejection:', e));
process.on('uncaughtException', (e) => console.error('UncaughtException:', e));