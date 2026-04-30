/* eslint-disable */
// ============================================================
// Upload em lote de fotos de funcionários do RH.
//
// Lê /Users/tiagocameli/Desktop/Fotos RH/<Nome do funcionário>/<arquivo>
// e:
//   1. Faz match com apont_funcionarios.nome (normalizado: lowercase,
//      sem acentos/pontuação/parênteses).
//   2. Faz upload pro bucket "apontamento-fotos" no path
//      <funcionarioId>/perfil-0-<timestamp>.jpg
//   3. Atualiza foto_perfil + fotos_referencia_facial = [path].
//
// Uso:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/upload-fotos-rh.mjs [pasta-base]
//
// Pode também usar SUPABASE_EMAIL + SUPABASE_PASSWORD pra autenticar
// como usuário (em vez do service role).
// ============================================================

import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const FOTOS_BASE = process.argv[2] || "/Users/tiagocameli/Desktop/Fotos RH";
const BUCKET = "apontamento-fotos";

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const EMAIL = process.env.SUPABASE_EMAIL;
const PASSWORD = process.env.SUPABASE_PASSWORD;

if (!URL) {
  console.error("✗ Falta SUPABASE_URL (ou VITE_SUPABASE_URL).");
  process.exit(1);
}

let supabase;
if (SERVICE_ROLE) {
  console.log("• Auth: service role key (bypassa RLS)");
  supabase = createClient(URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
} else if (ANON_KEY && EMAIL && PASSWORD) {
  console.log("• Auth: signInWithPassword (anon key + login)");
  supabase = createClient(URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await supabase.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });
  if (error) {
    console.error("✗ Falha no login:", error.message);
    process.exit(1);
  }
} else {
  console.error("✗ Forneça SUPABASE_SERVICE_ROLE_KEY, OU SUPABASE_EMAIL + SUPABASE_PASSWORD.");
  process.exit(1);
}

function normalize(s) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

// Apelidos / variações conhecidas: pasta da foto → nome canônico no banco.
// Aplicado quando o match fuzzy não consegue resolver sozinho.
const APELIDOS = {
  dimas: "EDMILSON CASTRO CAVALCANTE",
};

// 1. Lê funcionários do banco
console.log("• Buscando funcionários no banco…");
const { data: funcs, error: errFuncs } = await supabase
  .from("apont_funcionarios")
  .select("id, nome, foto_perfil");
if (errFuncs) {
  console.error("✗ Falha ao listar funcionários:", errFuncs.message);
  process.exit(1);
}
console.log(`  → ${funcs.length} funcionários`);

const funcsByNorm = new Map();
for (const f of funcs) {
  funcsByNorm.set(normalize(f.nome), f);
}

// Fuzzy: tenta apelido conhecido, depois match exato no nome normalizado,
// e por fim substring (containment).
function findFuncionario(nomeFoto) {
  const k = normalize(nomeFoto);
  // Apelidos manuais primeiro
  if (APELIDOS[k]) {
    const alvo = normalize(APELIDOS[k]);
    if (funcsByNorm.has(alvo)) return funcsByNorm.get(alvo);
  }
  if (funcsByNorm.has(k)) return funcsByNorm.get(k);
  // Busca por substring: foto "francisca vangelina ribeiro" casa com
  // "francisca vangelina cazuza" se houver intersecção forte.
  const parts = k.match(/.{1,8}/g) || [];
  let best = null;
  let bestScore = 0;
  for (const [norm, f] of funcsByNorm) {
    // Conta tokens (sequências de 8 chars) presentes em ambos
    let score = 0;
    for (const p of parts) {
      if (norm.includes(p)) score++;
    }
    // Bônus quando o nome normalizado da foto cabe no do banco
    if (norm.startsWith(k.slice(0, Math.min(20, k.length)))) score += 3;
    if (norm.includes(k.slice(0, Math.min(15, k.length)))) score += 2;
    if (score > bestScore) {
      bestScore = score;
      best = f;
    }
  }
  return bestScore >= 2 ? best : null;
}

// 2. Lê pastas de fotos
console.log(`\n• Lendo pasta: ${FOTOS_BASE}`);
let entries;
try {
  entries = await fs.readdir(FOTOS_BASE, { withFileTypes: true });
} catch (e) {
  console.error("✗ Não consegui ler a pasta:", e.message);
  process.exit(1);
}

const pastas = entries.filter((e) => e.isDirectory());
console.log(`  → ${pastas.length} pastas`);

const result = { uploaded: 0, skipped: 0, failed: 0 };

for (const pasta of pastas) {
  const pastaPath = path.join(FOTOS_BASE, pasta.name);
  const files = (await fs.readdir(pastaPath)).filter((n) =>
    /\.(jpe?g|png|webp|heic)$/i.test(n)
  );
  if (files.length === 0) {
    console.log(`\n• ${pasta.name}: sem arquivos de imagem, pulando`);
    result.skipped++;
    continue;
  }
  // Pega o primeiro arquivo de imagem da pasta como foto principal.
  const fotoPath = path.join(pastaPath, files[0]);

  console.log(`\n• ${pasta.name}`);
  const f = findFuncionario(pasta.name);
  if (!f) {
    console.log(`  ⚠ funcionário não encontrado, pulando`);
    result.skipped++;
    continue;
  }
  console.log(`  ✓ match: ${f.nome} (${f.id.slice(0, 8)}…)`);

  if (f.foto_perfil) {
    console.log(`  ⚠ já tem foto_perfil, pulando (apague no app antes pra reenviar)`);
    result.skipped++;
    continue;
  }

  // Upload
  const buffer = await fs.readFile(fotoPath);
  const ext = path.extname(fotoPath).toLowerCase().replace(".", "") || "jpg";
  const storagePath = `${f.id}/perfil-0-${Date.now()}.${ext === "jpeg" ? "jpg" : ext}`;
  const contentType =
    ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";

  const { error: errUp } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { upsert: false, contentType });
  if (errUp) {
    console.log(`  ✗ upload falhou: ${errUp.message}`);
    result.failed++;
    continue;
  }
  console.log(`  ✓ upload: ${storagePath}`);

  // Atualiza linha
  const { error: errUpd } = await supabase
    .from("apont_funcionarios")
    .update({
      foto_perfil: storagePath,
      fotos_referencia_facial: [storagePath],
    })
    .eq("id", f.id);
  if (errUpd) {
    console.log(`  ✗ update falhou: ${errUpd.message}`);
    result.failed++;
    continue;
  }
  console.log(`  ✓ atualizado no banco`);
  result.uploaded++;
}

console.log("\n══════════════════════════════════");
console.log(`✓ enviados:   ${result.uploaded}`);
console.log(`⚠ pulados:    ${result.skipped}`);
console.log(`✗ falharam:   ${result.failed}`);
process.exit(result.failed > 0 ? 1 : 0);
