'use strict';

const assert = require('assert');
const {
  calcularPrazoProcessual,
  calcularPascoa,
  obterFeriadosNacionais,
  formatarDataBR
} = require('./src/processos/calculadoraPrazos');

console.log('🧪 Iniciando Bateria de Testes: Calculadora Nativa de Prazos Processuais (CPC / CLT)...\n');

let passou = 0;

function testar(nome, fn) {
  try {
    fn();
    console.log(`  ✅ [PASSOU] ${nome}`);
    passou++;
  } catch (err) {
    console.error(`  ❌ [FALHOU] ${nome}`);
    console.error('     Detalhe:', err.message);
    process.exitCode = 1;
  }
}

// 1. Fim de semana + Disponibilização DJEN (Art. 224 CPC)
testar('1. Fim de semana e Disponibilização no DJEN (sexta -> publ. segunda -> início terça)', () => {
  const res = calcularPrazoProcessual({
    dataDisponibilizacao: '13/03/2026', // Sexta-feira
    rito: 'CPC',
    dias: 5,
    eventoInicial: 'disponibilizacao'
  });

  assert.strictEqual(res.sucesso, true);
  assert.strictEqual(res.rito, 'CPC');
  assert.strictEqual(res.dataDisponibilizacao, '13/03/2026');
  assert.strictEqual(res.dataPublicacao, '16/03/2026'); // Segunda
  assert.strictEqual(res.dataInicioContagem, '17/03/2026'); // Terça
  assert.strictEqual(res.dataFinal, '23/03/2026'); // Segunda seguinte
  assert.strictEqual(res.resumoDiasPulados.finsDeSemana, 4); // 14, 15, 21, 22
});

// 2. Feriado Nacional 20/11 (Consciência Negra)
testar('2. Feriado Nacional de 20/11 (Dia da Consciência Negra)', () => {
  const res = calcularPrazoProcessual({
    dataDisponibilizacao: '2026-11-17', // Terça
    rito: 'CPC',
    dias: 5,
    eventoInicial: 'publicacao'
  });

  assert.strictEqual(res.dataPublicacao, '17/11/2026');
  assert.strictEqual(res.dataInicioContagem, '18/11/2026');
  assert.strictEqual(res.dataFinal, '25/11/2026'); // Pula 20/11 (feriado) + 21/11 + 22/11
  assert.strictEqual(res.resumoDiasPulados.feriadosNacionais, 1);
  assert.ok(
    res.diasPulados.some(d => d.data === '20/11/2026' && d.motivo.includes('Consciência Negra')),
    'Deve registrar 20/11/2026 como Dia da Consciência Negra'
  );
});

// 3. Feriados móveis dinâmicos: Páscoa, Carnaval (Seg/Ter), Sexta-Feira Santa e Corpus Christi
testar('3. Feriados móveis dinâmicos (Carnaval e Corpus Christi via algoritmo da Páscoa)', () => {
  const pascoa2026 = calcularPascoa(2026);
  assert.strictEqual(formatarDataBR(pascoa2026), '05/04/2026');

  const feriados2026 = obterFeriadosNacionais(2026);
  assert.ok(feriados2026.has('2026-02-16'), 'Segunda de Carnaval 2026');
  assert.ok(feriados2026.has('2026-02-17'), 'Terça de Carnaval 2026');
  assert.ok(feriados2026.has('2026-04-03'), 'Sexta-feira Santa 2026');
  assert.ok(feriados2026.has('2026-06-04'), 'Corpus Christi 2026');

  // Carnaval: Publicação sexta 13/02/2026 -> pula sáb/dom/seg/ter -> início qua 18/02 -> 5d = ter 24/02
  const resCarnaval = calcularPrazoProcessual({
    dataDisponibilizacao: '13/02/2026',
    rito: 'CPC',
    dias: 5,
    eventoInicial: 'publicacao'
  });
  assert.strictEqual(resCarnaval.dataInicioContagem, '18/02/2026');
  assert.strictEqual(resCarnaval.dataFinal, '24/02/2026');
  assert.strictEqual(resCarnaval.resumoDiasPulados.feriadosNacionais, 2);

  // Corpus Christi: Publicação ter 02/06/2026 -> dia 1 qua 03/06 -> pula qui 04/06 -> dia 2 sex 05/06 -> dia 3 seg 08/06
  const resCorpus = calcularPrazoProcessual({
    dataDisponibilizacao: '02/06/2026',
    rito: 'CPC',
    dias: 3,
    eventoInicial: 'publicacao'
  });
  assert.strictEqual(resCorpus.dataFinal, '08/06/2026');
  assert.ok(resCorpus.diasPulados.some(d => d.data === '04/06/2026' && d.motivo.includes('Corpus Christi')));
});

// 4. Suspensão automática no Recesso Forense de 20/12 a 20/01 (Art. 220 CPC)
testar('4. Suspensão automática do Recesso Forense 20/12 a 20/01 (Art. 220 CPC)', () => {
  const res = calcularPrazoProcessual({
    dataDisponibilizacao: '15/12/2026', // Terça
    rito: 'CPC',
    dias: 15,
    eventoInicial: 'publicacao'
  });

  assert.strictEqual(res.dataInicioContagem, '16/12/2026');
  assert.strictEqual(res.houveRecessoForense, true);
  assert.strictEqual(res.resumoDiasPulados.recessoForense, 32); // 20/12 a 31/12 (12d) + 01/01 a 20/01 (20d) = 32d
  assert.strictEqual(res.dataFinal, '05/02/2027');
});

// 5. Recurso Ordinário CLT (8 dias úteis) + Feriado Local
testar('5. Recurso Ordinário CLT (8 dias úteis) com suporte a feriado local', () => {
  const res = calcularPrazoProcessual({
    dataDisponibilizacao: '06/07/2026', // Segunda (DJEN)
    rito: 'CLT',
    dias: 8,
    eventoInicial: 'disponibilizacao',
    feriadosLocais: ['09/07/2026'] // Feriado estadual SP
  });

  assert.strictEqual(res.rito, 'CLT');
  assert.strictEqual(res.dataPublicacao, '07/07/2026');
  assert.strictEqual(res.dataInicioContagem, '08/07/2026');
  assert.strictEqual(res.dataFinal, '20/07/2026');
  assert.strictEqual(res.resumoDiasPulados.feriadosLocais, 1);
  assert.ok(res.diasPulados.some(d => d.data === '09/07/2026' && d.categoria === 'feriadosLocais'));
});

if (!process.exitCode) {
  console.log(`\n🎉 TODOS OS ${passou} TESTES DA CALCULADORA DE PRAZOS PASSARAM COM 100% DE SUCESSO!`);
}
