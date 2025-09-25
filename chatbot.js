// 1) IMPORTS
const express = require('express');
const { Client, LocalAuth, List } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');
const os = require('os');
const puppeteer = require('puppeteer');
const QRCode = require('qrcode');
const qrcodeTerminal = require('qrcode-terminal');

// 2) ESTADO
let latestQR = null;
let latestQRAt = null;

// 3) EXPRESS: app + rotas + listen
const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.get('/', (_req, res) => res.send('🤖 Chatbot online!'));

const noCache = (res) => {
  res.set('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma','no-cache'); res.set('Expires','0'); res.set('Surrogate-Control','no-store');
};

app.get('/qr.svg', async (_req, res) => {
  try {
    if (!latestQR) return res.status(204).end();
    noCache(res);
    const svg = await QRCode.toString(latestQR, { type:'svg', width:360, margin:4, errorCorrectionLevel:'M' });
    res.type('image/svg+xml').send(svg);
  } catch { res.status(500).send('Falha ao gerar QR'); }
});

app.get('/qr.png', async (_req, res) => {
  try {
    if (!latestQR) return res.status(204).end();
    noCache(res);
    const buf = await QRCode.toBuffer(latestQR, { type:'png', width:360, margin:4, errorCorrectionLevel:'M' });
    res.type('image/png').send(buf);
  } catch { res.status(500).send('Falha ao gerar QR'); }
});

app.get('/qr-plain', (_req, res) => {
  if (!latestQR) return res.send('<!doctype html><meta charset="utf-8"><h1>Já conectado ✅</h1>');
  noCache(res);
  res.type('html').send(`<!doctype html>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="5"><title>QR do WhatsApp</title>
<style>html,body{height:100%;margin:0;background:#fff}.wrap{display:flex;align-items:center;justify-content:center;height:100%}img{max-width:92vmin;max-height:92vmin;image-rendering:pixelated}</style>
<div class="wrap"><img src="/qr.png" alt="QR WhatsApp"></div>`);
});

// **APENAS UMA** vez:
app.listen(PORT, () => console.log(`Health-check na porta ${PORT}`));

// 4) WHATSAPP WEB.JS: perfil tempor., DATA_PATH, client, listeners, initialize
const tmpProfile = path.join(os.tmpdir(), 'wwebjs_tmp_profile');
try { fs.rmSync(tmpProfile, { recursive:true, force:true }); } catch {}

const DATA_PATH = process.env.WWEBJS_DATA_PATH || path.join(process.cwd(), '.wwebjs_auth');

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: DATA_PATH, clientId: 'default' }),
  puppeteer: {
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath(),
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote','--no-first-run','--no-default-browser-check', `--user-data-dir=${tmpProfile}`],
    timeout: 90000
  }
});

client.on('qr', (qr) => {
  latestQR = qr;
  latestQRAt = new Date();
  console.log('[QR] Aguardando leitura...');
  try { qrcodeTerminal.generate(qr, { small:true }); } catch {}
});

client.on('ready', () => { console.log('[READY] WhatsApp conectado'); latestQR = null; });
client.on('auth_failure', (m) => console.error('[AUTH_FAILURE]', m));
client.on('disconnected', (r) => console.error('[DISCONNECTED]', r));

// **APENAS UMA** vez:
client.initialize();


// ===== Utils =====
const delay = (ms) => new Promise((res) => setTimeout(res, ms));
const typing = async (chat, ms = 1200) => { await chat.sendStateTyping(); await delay(ms); };
const firstName = v => (v ? String(v).trim().split(/\s+/)[0] : '');


// ===== Cards / Textos =====
const menuText = (nome = '') => 
`Olá ${firstName(nome)}! 👋

Bem-vinda à família *Madala CF*💪 Com 10 anos de mercado, somos profissionais no compromisso que assumimos com você!
Sua saúde e bem-estar é a nossa prioridade.

Escolha uma opção para descobrir mais sobre a *Madala CF* (envie o número):
1 - 🏋️ Como funcionam as aulas de CrossFit
2 - 🥋 Aulas de judô com Sensei Jeferson todos os dias.
3 - 🌐 Redes sociais Madala CF
4 - 🏆 Eventos Madala CF
0 - ☎ Falar com Tchê (gerente geral)
`;

function cfPosMenu(nome='') {
  const n = firstName(nome);
  return `${n ? n + ', ' : ''}escolha uma opção (digite a palavra):
• *Mais*   → 📊 Planos e valores
• *Marcar* → 🗓️ Agendar aula experimental
• *Menu*   → 🔙 Voltar ao menu inicial
• *Sair*   → ❌ Encerrar`;
}

const RESPOSTAS = {
  comoFunciona: `*COMO FUNCIONA O CROSSFIT?*
• Treinos em grupo com coach supervisionando (todos os níveis).
• Aula com aquecimento e técnica.
• Escalas: Iniciante, Intermediário e Avançado.
• Avaliação inicial para ajustar cargas e movimentos.
• Abrimos de Seg a Sáb, das 6h às 21h.

📍 Localização: https://maps.app.goo.gl/nyDBAPzNLLBHYWMJ9

Bora fazer uma aula teste? 💪
✅ Agende sua aula experimental:
https://calendar.app.google/9r6mFZTPwUivm4x89`,

  planos: `*PLANOS E VALORES* (CrossFit premium)
💰 Trimestral: R$ 510/mês
💰 Semestral: R$ 440/mês
💰 Anual: R$ 360/mês

Formas de pagamento: Cartão, PIX, boleto.

✅ Agende sua aula experimental:
https://calendar.app.google/9r6mFZTPwUivm4x89`,

  agendarCrossfit: `🗓️ *Agendar aula experimental de CrossFit*
Escolha seu melhor horário pelo link:
https://calendar.app.google/9r6mFZTPwUivm4x89`,

  Modalidade_judo: `*Judô* 🥋
• Aulas todos os dias às 21h (1h).
• Instrutor: *Sensei Jeferson*.
• Mensalidade: R$ 150,00.

Quer agendar uma aula experimental?
Acesse: https://calendar.google.com/calendar/u/0/r/month/2025/9/24`,

  Eventos_madalacf: `*Eventos / Promoções*
Fique por dentro do que rola na Madala CF:
https://calendar.google.com/calendar/u/0/r/month/2024/6/1`,

  atendente: `Este é o contato do *Tchê* (gerente geral) 👨‍💼
Pronto para te ajudar com qualquer dúvida ou suporte.

WhatsApp: https://wa.me/qr/LI5TG3DW5XAZF1

Envie uma mensagem e aguarde um momento para retorno.`,  

  Redes_sociais: `*REDES SOCIAIS MADALA CF* 📱
📸 Instagram: https://www.instagram.com/madalacf/
👍 Facebook:  https://www.facebook.com/madalacf
▶️ YouTube:   https://www.youtube.com/@madalacf
🌐 Site:      https://madalacf.com.br`
};

// ===== Estado simples por chat =====
const estado = {}; // { [chatId]: 'MAIN' | 'CF_MENU' }

// ===== Menu (List) com fallback =====
async function enviarMenu(msg, chat, nome) {
  await typing(chat);

  // (1) Fallback em texto (funciona em qualquer dispositivo)
  await client.sendMessage(msg.from, menuText(nome));

  // (2) Tenta enviar o List (melhor UX no celular)
  try {
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
    const list = new List('Toque em "Ver opções" para abrir a lista.', 'Ver opções', sections, 'Madala CF', 'Ou digite o número aqui.');
    await client.sendMessage(msg.from, list);
  } catch (e) {
    console.warn('List não enviado (seguindo apenas com o texto do menu).', e?.message || e);
  }
}

// ===== Router principal (UM ÚNICO listener) =====
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

    // Gatilho de saudação/menu → abre o menu inicial
    const ehSaudacao = /(menu|dia|tarde|noite|oi|ola|olá|oie|hey|eai)/i.test(asciiText);
    if (ehSaudacao) {
      estado[chatId] = 'MAIN';          // reseta estado
      await enviarMenu(msg, chat, nome);
      return;
    }

    // Estado atual
    const st = estado[chatId] || 'MAIN';

    // ===== MAIN (menu principal) =====
    if (st === 'MAIN') {
      // 1) CrossFit → "Como funciona" + pós-menu CF
      if (asciiText === '1' || lowerText.startsWith('1 - 🏋️')) {
        await typing(chat);
        await client.sendMessage(chatId, RESPOSTAS.comoFunciona);
        await client.sendMessage(chatId, cfPosMenu(nome));
        estado[chatId] = 'CF_MENU';
        return;
      }

      // 2) Judô
      if (asciiText === '2' || lowerText.startsWith('2 - 🥋')) {
        await typing(chat);
        await client.sendMessage(chatId, RESPOSTAS.Modalidade_judo);
        await enviarMenu(msg, chat, nome);
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

    // ===== CF_MENU (pós-menu do CrossFit) =====
    if (st === 'CF_MENU') {
      // "mais" → planos
      if (['mais','planos','valores','precos','preços'].includes(asciiText)) {
        await typing(chat);
        await client.sendMessage(chatId, RESPOSTAS.planos);
        await client.sendMessage(chatId, cfPosMenu(nome));  // permanece no CF_MENU
        return;
      }

      // "marcar" → agendamento
      if (['marcar','agendar','agendamento'].includes(asciiText)) {
        await typing(chat);
        await client.sendMessage(chatId, RESPOSTAS.agendarCrossfit);
        await client.sendMessage(chatId, cfPosMenu(nome));
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

// ===== EXPRESS / HEALTH / QR WEB =====
const QR_SECRET = process.env.QR_SECRET || '';

function checkQrAuth(req, res, next) {
  if (!QR_SECRET) return next(); // se não definir QR_SECRET, libera acesso
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const token = req.query.token || req.headers['x-qr-token'] || bearer;
  if (token === QR_SECRET) return next();
  return res.status(401).send('Unauthorized');
}


// Exibe o QR no navegador quando disponível
// Acesse: https://SEU_DOMINIO/qr?token=SEU_TOKEN (se definir QR_SECRET)
app.get('/qr', async (req, res) => {
  try {
    if (QR_SECRET && req.query.token !== QR_SECRET) {
      return res.status(401).send('Não autorizado');
    }
    if (!latestQR) {
      return res.status(404).send('Sem QR disponível (já conectado ou aguardando reinício).');
    }
    const dataUrl = await QRCode.toDataURL(latestQR);
    res.type('text/html; charset=utf-8').send(`
      <!doctype html>
      <html>
        <head><meta charset="utf-8"><title>QR WhatsApp</title></head>
        <body style="font-family:system-ui, sans-serif; text-align:center; padding:24px">
          <h2>Escaneie no WhatsApp → Aparelhos conectados → Conectar um aparelho</h2>
          <p>Gerado em: ${latestQRAt?.toLocaleString('pt-BR') || '-'}</p>
          <img src="${dataUrl}" alt="QR WhatsApp" style="max-width:360px; width:100%; height:auto;"/>
        </body>
      </html>
    `);
  } catch (e) {
    console.error('[QR_ROUTE_ERROR]', e);
    res.status(500).send('Falha ao gerar/exibir o QR.');
  }
});


// Logs de erros não tratados
process.on('unhandledRejection', (e) => console.error('UnhandledRejection:', e));
process.on('uncaughtException', (e) => console.error('UncaughtException:', e));
