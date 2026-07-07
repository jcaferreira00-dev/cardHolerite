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
const UNIDADE_REF_KLABIN = 4736;     // Dados!E13 - base para Prev. Privada (PGBL)
const PISO_SALARIAL      = 2020;     // Holerite!F24 - base para mensalidade sindical
const CESTA_ALIMENTOS    = 550;      // Holerite!F25 - base para vale alimentação

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
  if (baseProventos <= 2902.84)  return baseProventos * 0.09  - 16.5;
  if (baseProventos <= 4354.27)  return baseProventos * 0.12  - 82.604;
  if (baseProventos <= 8475.55)  return baseProventos * 0.14  - 148.708;
  return 988.07; // teto INSS
}

/* =========================================================
   CÁLCULO PRINCIPAL
   ========================================================= */
function calcular(){
  // ---- INPUTS DO USUÁRIO ----
  const salarioBase        = num('salarioBase');
  const diasTrabalhados     = num('diasTrabalhados') || 30;
  const dependentes         = num('dependentes');
  const domingosFeriados    = num('domingosFeriados');

  const he70Diurna   = num('he70Diurna');
  const he70Noturna  = num('he70Noturna');
  const he100Diurna  = num('he100Diurna');
  const he100Noturna = num('he100Noturna');
  const he100Feriado = num('he100Feriado');
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
  const he70D     = (salarioBase / 180) * 1.7 * he70Diurna;
  const he70N     = (salarioBase / 180) * 1.7 * he70Noturna;
  const he100D    = (salarioBase / 180) * 2   * he100Diurna;
  const he100N    = (salarioBase / 180) * 2   * he100Noturna;
  const he100Fer  = (salarioBase / 180) * 2   * he100Feriado;

  const diasNaoDSR = 30 - domingosFeriados;
  const reflexoHeDSR = diasNaoDSR > 0
    ? (he70D + he70N + he100D + he100N + he100Fer) / diasNaoDSR * domingosFeriados
    : 0;

  const adicionalNoturno40 = (salario / 180) * 0.4 * horasAdNoturno;
  const reflexoAdNoturnoDSR = diasNaoDSR > 0
    ? adicionalNoturno40 / diasNaoDSR * domingosFeriados
    : 0;
  const adicionalNoturno40He = (he70N + he100N) * 0.4;

  const totalProventos = salario + he70D + he70N + he100D + he100N + he100Fer
    + reflexoHeDSR + adicionalNoturno40 + reflexoAdNoturnoDSR + adicionalNoturno40He;

  // ---- CÁLCULO DE DESCONTOS ----
  const inss = calcINSS(totalProventos);

  const prevPrivada = ativarPrevPrivada
    ? Math.max(0, (salarioBase - UNIDADE_REF_KLABIN) * 0.9 / 10)
    : 0;

  const baseIRRF = totalProventos - (dependentes * DEDUCAO_DEPENDENTE) - inss - prevPrivada;
  const faixa = IRRF_TABLE.find(f => baseIRRF >= f.min && baseIRRF <= f.max)
    || IRRF_TABLE[IRRF_TABLE.length - 1];
  const irrf = Math.max(0, baseIRRF * (faixa.pct / 100) - faixa.ded);

  const mensalidadeSindical = ativarSindicato ? PISO_SALARIAL * (sindicatoPct / 100) : 0;
  const adiantamento = ativarAdiantamento ? 0.4 * salarioBase : 0;
  const valeAlimentacao = CESTA_ALIMENTOS * (valeAlimentacaoPct / 100);

  const totalDescontos = inss + irrf + prevPrivada + mensalidadeSindical + adiantamento
    + odonto + farmacia + despesasMedicas + refeicao + valeAlimentacao;

  const liquido = totalProventos - totalDescontos;
  const fgts = totalProventos * 0.08;

  // ---- RENDER NO CARD ----
  document.getElementById('liquidoValor').textContent = fmt(liquido);
  document.getElementById('proventosValor').textContent = 'R$ ' + fmt(totalProventos);
  document.getElementById('descontosValor').textContent = 'R$ ' + fmt(totalDescontos);
  document.getElementById('fgtsValor').textContent = 'R$ ' + fmt(fgts);
}

/* =========================================================
   EVENT LISTENERS
   ========================================================= */

// ---- Modal open/close ----
const overlay = document.getElementById('overlay');

document.getElementById('openModal').addEventListener('click', () => {
  overlay.classList.add('open');
});

document.getElementById('closeModal').addEventListener('click', () => {
  overlay.classList.remove('open');
});

overlay.addEventListener('click', (e) => {
  if (e.target === overlay) {
    overlay.classList.remove('open');
  }
});

// ---- Calcular e fechar modal ----
document.getElementById('calcConfirm').addEventListener('click', () => {
  calcular();
  overlay.classList.remove('open');
});

// ---- Limpar formulário ----
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

// ---- Tema claro/escuro ----
const themeBtn = document.getElementById('themeToggle');

themeBtn.addEventListener('click', () => {
  const root = document.body;
  const isDark = root.getAttribute('data-theme') === 'dark';
  root.setAttribute('data-theme', isDark ? 'light' : 'dark');
  themeBtn.textContent = isDark ? '🌙' : '☀️';
});

// ---- Inicializar ----
calcular();
