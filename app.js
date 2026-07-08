/* =========================================================
   PARÂMETROS FIXOS (tabelas oficiais) — não editáveis na UI
   Baseado na planilha holerite.xlsm (aba Holerite / Dados)
   ========================================================= */
const IRRF_TABLE = [
  { min: 0,        max: 2480.80,  pct: 0,    ded: 0 },
  { min: 2480.81,  max: 2826.65,  pct: 7.5,  ded: 182.16 },
  { min: 2826.66,  max: 3751.05,  pct: 15,   ded: 394.16 },
  { min: 3751.06,  max: 4664.68,  pct: 22.5, ded: 675.49 },
  { min: 4664.69,  max: Infinity, pct: 27.5, ded: 908.73 },
];

const DEDUCAO_DEPENDENTE = 189.59;   // Dados!D9
const UNIDADE_REF_KLABIN = 4736;     // Dados!E13 - base para "PACK Básico VGBL" (não é PGBL, confirmado no holerite real)
const PISO_SALARIAL      = 2020;     // Holerite!F24 - base para mensalidade sindical
const CESTA_ALIMENTOS    = 550;      // Holerite!F25 - base para vale alimentação

// Campos que são "lembrados" de um mês para o outro (persistidos no localStorage)
const FIXED_FIELD_IDS = [
  'salarioBase', 'diasTrabalhados', 'dependentes', 'domingosFeriados',
  'odonto', 'refeicao', 'valeAlimentacaoPct', 'sindicatoPct',
  'decimoTerceiroParcela1', 'decimoTerceiroParcela2'
];
// Toggles que também são lembrados (mesmo esquema, mas usam .checked em vez de .value)
const FIXED_TOGGLE_IDS = ['ativarAdiantamento', 'ativarPrevPrivada', 'ativarSindicato'];
const STORAGE_KEY = 'holerite_campos_fixos_v1';

// Campos "de sessão": variam a cada cálculo e disparam a confirmação de saída
const SESSION_FIELD_IDS = [
  'he50', 'he70Diurna', 'he70Noturna', 'he100Diurna', 'he100Noturna',
  'he100Feriado', 'horasAdNoturno', 'farmacia', 'despesasMedicas'
];

/* =========================================================
   FUNÇÕES AUXILIARES
   ========================================================= */
function num(id){
  return parseFloat(document.getElementById(id).value) || 0;
}

function fmt(v){
  return v.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function calcINSS(baseProventos){
  if (baseProventos <= 1621)     return baseProventos * 0.075;
  if (baseProventos <= 2902.84)  return baseProventos * 0.09  - 24.32;
  if (baseProventos <= 4354.27)  return baseProventos * 0.12  - 111.40;
  if (baseProventos <= 8475.55)  return baseProventos * 0.14  - 198.49;
  return 988.07; // teto INSS — confirmado no holerite real de Junho/2026 (Contr. INSS Remuneração)
}

/* =========================================================
   PERSISTÊNCIA DOS CAMPOS FIXOS
   ========================================================= */
function salvarCamposFixos(){
  const dados = {};
  FIXED_FIELD_IDS.forEach(id => {
    dados[id] = document.getElementById(id).value;
  });
  FIXED_TOGGLE_IDS.forEach(id => {
    dados[id] = document.getElementById(id).checked;
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(dados));
}

function carregarCamposFixos(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const dados = JSON.parse(raw);
    FIXED_FIELD_IDS.forEach(id => {
      if (dados[id] !== undefined && dados[id] !== '') {
        document.getElementById(id).value = dados[id];
      }
    });
    FIXED_TOGGLE_IDS.forEach(id => {
      if (dados[id] !== undefined) {
        document.getElementById(id).checked = dados[id];
      }
    });
  } catch (e) {
    console.warn('Não foi possível carregar os campos fixos salvos.', e);
  }
}

/* =========================================================
   CÁLCULO PRINCIPAL
   ========================================================= */
let ultimoCalculo = null; // guarda os totais do último cálculo, pra permitir editar a Base IR sem reabrir o modal

function calcular(){
  // ---- INPUTS DO USUÁRIO ----
  const salarioBase        = num('salarioBase');
  const diasTrabalhados     = num('diasTrabalhados') || 30;
  const dependentes         = num('dependentes');
  const domingosFeriados    = num('domingosFeriados');

  const he50         = num('he50');
  const he70Diurna    = num('he70Diurna');
  const he70Noturna   = num('he70Noturna');
  const he100Diurna   = num('he100Diurna');
  const he100Noturna  = num('he100Noturna');
  const he100Feriado  = num('he100Feriado');
  const horasAdNoturno = num('horasAdNoturno');

  const odonto = num('odonto');
  const farmacia = num('farmacia');
  const despesasMedicas = num('despesasMedicas');
  const refeicao = num('refeicao');
  const valeAlimentacaoPct = num('valeAlimentacaoPct');

  const ativarAdiantamento = document.getElementById('ativarAdiantamento').checked;
  const ativarPrevPrivada  = document.getElementById('ativarPrevPrivada').checked;
  const ativarSindicato    = document.getElementById('ativarSindicato').checked;
  const sindicatoPct       = num('sindicatoPct');

  // ---- CÁLCULO DE PROVENTOS ----
  const salario   = salarioBase / 30 * diasTrabalhados;
  const he50v     = (salarioBase / 180) * 1.5 * he50;
  const he70D     = (salarioBase / 180) * 1.7 * he70Diurna;
  const he70N     = (salarioBase / 180) * 1.7 * he70Noturna;
  const he100D    = (salarioBase / 180) * 2   * he100Diurna;
  const he100N    = (salarioBase / 180) * 2   * he100Noturna;
  const he100Fer  = (salarioBase / 180) * 2   * he100Feriado;

  const diasNaoDSR = 30 - domingosFeriados;
  const reflexoHeDSR = diasNaoDSR > 0
    ? (he50v + he70D + he70N + he100D + he100N + he100Fer) / diasNaoDSR * domingosFeriados
    : 0;

  const adicionalNoturno40 = (salario / 180) * 0.4 * horasAdNoturno;
  const reflexoAdNoturnoDSR = diasNaoDSR > 0
    ? adicionalNoturno40 / diasNaoDSR * domingosFeriados
    : 0;
  const adicionalNoturno40He = (he70N + he100N) * 0.4;

  const totalProventos = salario + he50v + he70D + he70N + he100D + he100N + he100Fer
    + reflexoHeDSR + adicionalNoturno40 + reflexoAdNoturnoDSR + adicionalNoturno40He;

  // ---- CÁLCULO DE DESCONTOS (exceto IRRF, que depende da Base IR editável) ----
  const inss = calcINSS(totalProventos);

  // "PACK Básico VGBL" - é VGBL, não PGBL, então NÃO reduz a base do IR
  // (confirmado no holerite real: base IR = proventos - INSS - dependentes, sem subtrair o VGBL)
  const prevPrivada = ativarPrevPrivada
    ? Math.max(0, (salarioBase - UNIDADE_REF_KLABIN) * 0.9 / 10)
    : 0;

  const mensalidadeSindical = ativarSindicato ? PISO_SALARIAL * (sindicatoPct / 100) : 0;
  const adiantamento = ativarAdiantamento ? 0.4 * salarioBase : 0;
  const valeAlimentacao = CESTA_ALIMENTOS * (valeAlimentacaoPct / 100);

  const outrosDescontosSemIRRF = inss + prevPrivada + mensalidadeSindical + adiantamento
    + odonto + farmacia + despesasMedicas + refeicao + valeAlimentacao;

  const baseIRAuto = Math.max(0, totalProventos - (dependentes * DEDUCAO_DEPENDENTE) - inss);
  const fgts = totalProventos * 0.08;

  ultimoCalculo = { totalProventos, outrosDescontosSemIRRF, fgts, baseIRAuto };

  // Preenche a Base IR com o valor recém-calculado (o usuário pode ajustar depois, se necessário)
  document.getElementById('baseIRValor').value = baseIRAuto.toFixed(2);

  aplicarBaseIR(baseIRAuto);
  atualizarDecimoTerceiro();
}

// Recalcula IRRF/Descontos/Líquido a partir de uma Base IR (automática ou editada manualmente),
// sem precisar refazer todo o cálculo de proventos.
function aplicarBaseIR(baseIR){
  if (!ultimoCalculo) return;
  const faixa = IRRF_TABLE.find(f => baseIR >= f.min && baseIR <= f.max)
    || IRRF_TABLE[IRRF_TABLE.length - 1];
  const irrf = Math.max(0, baseIR * (faixa.pct / 100) - faixa.ded);

  const totalDescontos = ultimoCalculo.outrosDescontosSemIRRF + irrf;
  const liquido = ultimoCalculo.totalProventos - totalDescontos;

  // ---- RENDER NO CARD ----
  document.getElementById('liquidoValor').textContent = fmt(liquido);
  document.getElementById('proventosValor').textContent = 'R$ ' + fmt(ultimoCalculo.totalProventos);
  document.getElementById('descontosValor').textContent = 'R$ ' + fmt(totalDescontos);
  document.getElementById('fgtsValor').textContent = 'R$ ' + fmt(ultimoCalculo.fgts);
}

/* =========================================================
   MODAL: abrir / fechar / confirmação de saída
   ========================================================= */
const overlay = document.getElementById('overlay');
const confirmOverlay = document.getElementById('confirmOverlay');

function possuiDadosNaoCalculados(){
  // Adiantamento, previdência e sindicato agora são campos "lembrados": chegam
  // marcados sozinhos ao reabrir, então não contam como dado novo/não calculado.
  return SESSION_FIELD_IDS.some(id => {
    const v = document.getElementById(id).value;
    return v !== undefined && v.trim() !== '';
  });
}

function abrirModal(){
  overlay.classList.add('open');
}

function fecharModalDireto(){
  overlay.classList.remove('open');
  confirmOverlay.classList.remove('open');
}

function tentarFecharModal(){
  if (possuiDadosNaoCalculados()) {
    confirmOverlay.classList.add('open');
  } else {
    fecharModalDireto();
  }
}

document.getElementById('openModal').addEventListener('click', abrirModal);
document.getElementById('closeModal').addEventListener('click', tentarFecharModal);

overlay.addEventListener('click', (e) => {
  if (e.target === overlay) {
    tentarFecharModal();
  }
});

document.getElementById('confirmStay').addEventListener('click', () => {
  confirmOverlay.classList.remove('open');
});

document.getElementById('confirmLeave').addEventListener('click', () => {
  fecharModalDireto();
});

// ---- Calcular: salva os campos fixos e fecha sem pedir confirmação ----
document.getElementById('calcConfirm').addEventListener('click', () => {
  calcular();
  salvarCamposFixos();
  overlay.classList.remove('open');
});

// ---- Limpar formulário (mantém os campos fixos salvos intactos no storage) ----
document.getElementById('clearForm').addEventListener('click', () => {
  document.querySelectorAll('.sheet-body input[type="number"]').forEach(i => i.value = '');
  document.querySelectorAll('.sheet-body input[type="checkbox"]').forEach(i => i.checked = false);
  document.getElementById('sindicatoPctWrap').style.display = 'none';
  calcular();
});

// ---- Toggle mensalidade sindical ----
document.getElementById('ativarSindicato').addEventListener('change', function(){
  document.getElementById('sindicatoPctWrap').style.display = this.checked ? 'block' : 'none';
});

// ---- Base IR editável (no card principal, fora do modal) ----
document.getElementById('baseIRValor').addEventListener('input', function(){
  const v = parseFloat(this.value);
  aplicarBaseIR(isNaN(v) ? 0 : v);
});
document.getElementById('resetBaseIR').addEventListener('click', () => {
  if (!ultimoCalculo) return;
  document.getElementById('baseIRValor').value = ultimoCalculo.baseIRAuto.toFixed(2);
  aplicarBaseIR(ultimoCalculo.baseIRAuto);
});

// ---- 13º salário (duas parcelas, não entra no líquido do mês) ----
function atualizarDecimoTerceiro(){
  const total = num('decimoTerceiroParcela1') + num('decimoTerceiroParcela2');
  document.getElementById('decimoTerceiroTotal').textContent = 'R$ ' + fmt(total);
}
document.getElementById('decimoTerceiroParcela1').addEventListener('input', atualizarDecimoTerceiro);
document.getElementById('decimoTerceiroParcela2').addEventListener('input', atualizarDecimoTerceiro);

// ---- Salva automaticamente os campos fixos sempre que forem editados ----
FIXED_FIELD_IDS.forEach(id => {
  document.getElementById(id).addEventListener('change', salvarCamposFixos);
});
FIXED_TOGGLE_IDS.forEach(id => {
  document.getElementById(id).addEventListener('change', salvarCamposFixos);
});

// ---- Tema claro/escuro ----
const themeBtn = document.getElementById('themeToggle');

themeBtn.addEventListener('click', () => {
  const root = document.body;
  const isDark = root.getAttribute('data-theme') === 'dark';
  root.setAttribute('data-theme', isDark ? 'light' : 'dark');
  themeBtn.textContent = isDark ? '🌙' : '☀️';
});

// ---- Inicializar ----
carregarCamposFixos();
// Sincroniza a visibilidade do campo de % do sindicato com o estado salvo
document.getElementById('sindicatoPctWrap').style.display =
  document.getElementById('ativarSindicato').checked ? 'block' : 'none';
calcular();
