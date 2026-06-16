const express = require('express');
const { execFile } = require('child_process');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
app.use(express.json({ limit: '20mb' }));
app.use(express.static(__dirname));

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PLANNING_FILE = 'C:\\Jarvis\\planning.json';
const HELPER_SCRIPT = 'C:\\Jarvis\\jarvis_helper.py';

// ── Python helper ────────────────────────────────────────────────────────────

function runPython(args) {
  return new Promise((resolve, reject) => {
    execFile('py', [HELPER_SCRIPT, ...args], { timeout: 30000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
        return;
      }
      try {
        resolve(JSON.parse(stdout.trim()));
      } catch {
        resolve({ output: stdout.trim() });
      }
    });
  });
}

// ── Planning helpers ──────────────────────────────────────────────────────────

function loadPlanning() {
  try {
    if (fs.existsSync(PLANNING_FILE)) {
      return JSON.parse(fs.readFileSync(PLANNING_FILE, 'utf8'));
    }
  } catch {}
  return [];
}

function savePlanning(tasks) {
  const dir = path.dirname(PLANNING_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(PLANNING_FILE, JSON.stringify(tasks, null, 2), 'utf8');
}

// ── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(planning) {
  const today = new Date().toLocaleDateString('nl-NL', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  const pending = planning.filter(t => !t.gedaan);

  const planningText = pending.length
    ? pending.map(t =>
        `ID ${t.id}: ${t.taak} — datum: ${t.datum || 'onbekend'}, prioriteit: ${t.prioriteit || 'normaal'}`
      ).join('\n')
    : 'Geen openstaande taken.';

  return `Je bent JARVIS, de persoonlijke AI-assistent van Luis. Vandaag is het ${today}.

KRITIEKE REGELS:
- Spreek ALTIJD in het Nederlands.
- Gebruik NOOIT markdown, asterisken (*), hashtags (#), emoji of opsommingstekens (•, -, *).
- Schrijf in gewone lopende tekst. Geen koppen, geen lijsten, geen opmaak.
- Wees beknopt en direct. Geen onnodige inleiding of herhaling.

OVER LUIS:
Luis is een scholier in Nijlen en werkt als freelance webontwikkelaar. Zijn vaste klanten zijn De Bareel, De Gouden Lepel, SHE Nail and Beauty, Groep VDH Mercedes en Autohandel Van Den Eynde. Hij werkt voornamelijk met Next.js 14, Tailwind CSS en Framer Motion.

HUIDIGE PLANNING:
${planningText}

BESCHIKBARE COMMANDO'S:
Wanneer Luis iets vraagt dat een van deze acties vereist, zet je het commando EXACT aan het begin van je antwoord op een aparte regel, gevolgd door je uitleg.

MAKE_WORD:pad:inhoud — maakt een Word document aan op het opgegeven pad.
MAKE_EXCEL:pad:inhoud — maakt een Excel bestand aan (inhoud als komma-gescheiden rijen, rijen gescheiden door \\n).
MAKE_PPT:pad:inhoud — maakt een PowerPoint presentatie aan.
OPEN_FILE:pad — opent een bestand met het standaardprogramma.
TAKE_SCREENSHOT: — maakt een screenshot van het scherm en analyseert het.
PLANNING_ADD:taak:datum — voegt een taak toe aan de planning (datum formaat: DD-MM-YYYY).
PLANNING_DONE:id — markeert een taak als afgerond.

Gebruik commando's alleen als ze echt nodig zijn. Reageer vriendelijk en professioneel.`;
}

// ── Command parser (strips commands from Claude response and executes them) ────

async function parseAndExecuteCommands(text, planning) {
  const lines = text.split('\n');
  const fileCommands = [];   // raw command strings to execute after parsing
  const executedNames = [];  // simple names for the response metadata
  const cleanLines = [];
  const extraInfo = {};

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('PLANNING_ADD:')) {
      const parts = trimmed.split(':');
      const newTask = {
        id: Date.now().toString(),
        taak: parts[1] || '',
        datum: parts[2] || '',
        prioriteit: 'normaal',
        gedaan: false
      };
      planning.push(newTask);
      savePlanning(planning);
      executedNames.push('PLANNING_ADD');
      extraInfo.newTask = newTask;

    } else if (trimmed.startsWith('PLANNING_DONE:')) {
      const id = trimmed.split(':')[1];
      const task = planning.find(t => t.id === id);
      if (task) { task.gedaan = true; savePlanning(planning); }
      executedNames.push('PLANNING_DONE');

    } else if (
      trimmed.startsWith('MAKE_WORD:') || trimmed.startsWith('MAKE_EXCEL:') ||
      trimmed.startsWith('MAKE_PPT:')  || trimmed.startsWith('OPEN_FILE:')  ||
      trimmed.startsWith('TAKE_SCREENSHOT:')
    ) {
      // Strip command line from spoken/shown text, queue for execution
      fileCommands.push(trimmed);

    } else {
      cleanLines.push(line);
    }
  }

  // Execute file/screen commands
  for (const cmd of fileCommands) {
    try {
      if (cmd.startsWith('MAKE_WORD:')) {
        const parts = cmd.split(':');
        await runPython(['make_word', parts[1], parts.slice(2).join(':')]);
        executedNames.push('MAKE_WORD');
      } else if (cmd.startsWith('MAKE_EXCEL:')) {
        const parts = cmd.split(':');
        await runPython(['make_excel', parts[1], parts.slice(2).join(':')]);
        executedNames.push('MAKE_EXCEL');
      } else if (cmd.startsWith('MAKE_PPT:')) {
        const parts = cmd.split(':');
        await runPython(['make_pptx', parts[1], parts.slice(2).join(':')]);
        executedNames.push('MAKE_PPT');
      } else if (cmd.startsWith('OPEN_FILE:')) {
        const filePath = cmd.split(':').slice(1).join(':');
        exec(`start "" "${filePath}"`, () => {});
        executedNames.push('OPEN_FILE');
      } else if (cmd.startsWith('TAKE_SCREENSHOT:')) {
        const result = await runPython(['take_screenshot']);
        extraInfo.base64 = result.base64;
        executedNames.push('TAKE_SCREENSHOT');
      }
    } catch (e) {
      console.error('Command error:', cmd, e.message);
    }
  }

  return { cleanText: cleanLines.join('\n').trim(), commands: executedNames, extraInfo };
}

// ── Routes ────────────────────────────────────────────────────────────────────

app.get('/api/planning', (req, res) => {
  try {
    res.json(loadPlanning());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/planning', (req, res) => {
  try {
    const tasks = loadPlanning();
    const { taak, datum, prioriteit } = req.body;
    if (!taak) return res.status(400).json({ error: 'taak is verplicht' });
    const newTask = {
      id: Date.now().toString(),
      taak,
      datum: datum || '',
      prioriteit: prioriteit || 'normaal',
      gedaan: false
    };
    tasks.push(newTask);
    savePlanning(tasks);
    res.json(newTask);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/planning/:id', (req, res) => {
  try {
    const tasks = loadPlanning();
    const task = tasks.find(t => t.id === req.params.id);
    if (!task) return res.status(404).json({ error: 'Taak niet gevonden' });
    task.gedaan = true;
    savePlanning(tasks);
    res.json(task);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/office', async (req, res) => {
  const { action, path: filePath, content } = req.body;
  if (!action || !filePath) {
    return res.status(400).json({ error: 'action en path zijn verplicht' });
  }
  try {
    let result;
    if (action === 'word') {
      result = await runPython(['make_word', filePath, content || '']);
    } else if (action === 'excel') {
      result = await runPython(['make_excel', filePath, content || '']);
    } else if (action === 'pptx') {
      result = await runPython(['make_pptx', filePath, content || '']);
    } else {
      return res.status(400).json({ error: `Onbekende actie: ${action}` });
    }
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/screenshot', async (req, res) => {
  try {
    const result = await runPython(['take_screenshot']);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/chat', async (req, res) => {
  const { messages, screenshotBase64 } = req.body;
  if (!messages || !messages.length) {
    return res.status(400).json({ error: 'messages is verplicht' });
  }

  const planning = loadPlanning();

  try {
    // Handle direct user-triggered commands
    const lastMsg = messages[messages.length - 1];
    const userText = typeof lastMsg.content === 'string' ? lastMsg.content : '';

    // Direct command handling (when frontend sends raw commands)
    if (userText.startsWith('PLANNING_ADD:')) {
      const parts = userText.split(':');
      const task = { id: Date.now().toString(), taak: parts[1] || '', datum: parts[2] || '', prioriteit: 'normaal', gedaan: false };
      planning.push(task);
      savePlanning(planning);
      return res.json({ response: `Taak toegevoegd: ${task.taak}${task.datum ? ' op ' + task.datum : ''}.`, commands: ['PLANNING_ADD'], planning });
    }

    if (userText.startsWith('PLANNING_DONE:')) {
      const id = userText.split(':')[1];
      const task = planning.find(t => t.id === id);
      if (task) { task.gedaan = true; savePlanning(planning); }
      return res.json({ response: task ? `Taak "${task.taak}" gemarkeerd als gedaan.` : 'Taak niet gevonden.', commands: ['PLANNING_DONE'], planning });
    }

    if (userText.startsWith('MAKE_WORD:')) {
      const parts = userText.split(':');
      const filePath = parts[1];
      const content = parts.slice(2).join(':');
      try {
        await runPython(['make_word', filePath, content]);
        return res.json({ response: `Word document aangemaakt op ${filePath}.`, commands: ['MAKE_WORD'] });
      } catch (e) {
        return res.json({ response: `Fout bij aanmaken Word document: ${e.message}`, commands: [] });
      }
    }

    if (userText.startsWith('MAKE_EXCEL:')) {
      const parts = userText.split(':');
      const filePath = parts[1];
      const content = parts.slice(2).join(':');
      try {
        await runPython(['make_excel', filePath, content]);
        return res.json({ response: `Excel bestand aangemaakt op ${filePath}.`, commands: ['MAKE_EXCEL'] });
      } catch (e) {
        return res.json({ response: `Fout bij aanmaken Excel bestand: ${e.message}`, commands: [] });
      }
    }

    if (userText.startsWith('MAKE_PPT:')) {
      const parts = userText.split(':');
      const filePath = parts[1];
      const content = parts.slice(2).join(':');
      try {
        await runPython(['make_pptx', filePath, content]);
        return res.json({ response: `PowerPoint aangemaakt op ${filePath}.`, commands: ['MAKE_PPT'] });
      } catch (e) {
        return res.json({ response: `Fout bij aanmaken PowerPoint: ${e.message}`, commands: [] });
      }
    }

    if (userText.startsWith('OPEN_FILE:')) {
      const filePath = userText.split(':').slice(1).join(':');
      exec(`start "" "${filePath}"`, (err) => {});
      return res.json({ response: `Bestand wordt geopend: ${filePath}.`, commands: ['OPEN_FILE'] });
    }

    if (userText.startsWith('TAKE_SCREENSHOT:') || userText === 'TAKE_SCREENSHOT') {
      try {
        const result = await runPython(['take_screenshot']);
        return res.json({ response: 'Screenshot gemaakt. Ik analyseer het scherm.', commands: ['TAKE_SCREENSHOT'], base64: result.base64 });
      } catch (e) {
        return res.json({ response: `Fout bij screenshot: ${e.message}`, commands: [] });
      }
    }

    // Build Claude messages
    const claudeMessages = messages.map((m, idx) => {
      if (idx === messages.length - 1 && screenshotBase64) {
        return {
          role: m.role,
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/png', data: screenshotBase64 } },
            { type: 'text', text: typeof m.content === 'string' ? m.content : 'Analyseer dit screenshot.' }
          ]
        };
      }
      return { role: m.role, content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) };
    });

    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1024,
      system: buildSystemPrompt(planning),
      messages: claudeMessages
    });

    const rawText = response.content[0].text;
    const { cleanText, commands, extraInfo } = await parseAndExecuteCommands(rawText, planning);

    res.json({
      response: cleanText,
      commands,
      planning: loadPlanning(),
      ...extraInfo
    });

  } catch (e) {
    console.error('Chat error:', e);
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`JARVIS server draait op http://localhost:${PORT}`);
});
