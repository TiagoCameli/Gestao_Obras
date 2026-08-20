import { describe, it, expect } from 'vitest';
import { calcularTotaisFrete } from './freteTotais';

describe('calcularTotaisFrete', () => {
  it('soma peso, valor de frete e valor de material', () => {
    const t = calcularTotaisFrete([
      { pesoToneladas: 30, valorTotal: 1000, valorMaterial: 3000 },
      { pesoToneladas: 20, valorTotal: 500, valorMaterial: 2000 },
    ]);
    expect(t.peso).toBe(50);
    expect(t.valor).toBe(1500);
    expect(t.valorMaterial).toBe(5000);
  });

  it('preço médio é ponderado pela tonelagem que carrega material', () => {
    // 30 t a R$ 100/t + 20 t a R$ 150/t = R$ 6.000 em 50 t = R$ 120,00/t
    const t = calcularTotaisFrete([
      { pesoToneladas: 30, valorTotal: 0, valorMaterial: 3000 },
      { pesoToneladas: 20, valorTotal: 0, valorMaterial: 3000 },
    ]);
    expect(t.precoMedioMaterial).toBeCloseTo(120, 6);
  });

  it('transferência não dilui o preço médio', () => {
    const material = { pesoToneladas: 30, valorTotal: 1000, valorMaterial: 3000 }; // R$ 100/t
    const transferencia = { pesoToneladas: 70, valorTotal: 900, valorMaterial: 0 };

    const soMaterial = calcularTotaisFrete([material]);
    const comTransferencia = calcularTotaisFrete([material, transferencia]);

    // O preço do material não mudou: nenhuma compra nova aconteceu.
    expect(comTransferencia.precoMedioMaterial).toBeCloseTo(100, 6);
    expect(comTransferencia.precoMedioMaterial).toBeCloseTo(soMaterial.precoMedioMaterial, 6);

    // Linha de controle: o peso e o custo de frete TÊM que ter subido, senão o
    // teste passaria mesmo se a transferência fosse ignorada por inteiro.
    expect(comTransferencia.peso).toBe(100);
    expect(comTransferencia.valor).toBe(1900);
    expect(comTransferencia.pesoComMaterial).toBe(30);
  });

  it('devolve 0 no preço médio quando nada carrega material', () => {
    const t = calcularTotaisFrete([{ pesoToneladas: 40, valorTotal: 800, valorMaterial: 0 }]);
    expect(t.precoMedioMaterial).toBe(0);
    expect(t.peso).toBe(40);
  });

  it('lista vazia não divide por zero', () => {
    const t = calcularTotaisFrete([]);
    expect(t).toEqual({ peso: 0, valor: 0, valorMaterial: 0, pesoComMaterial: 0, precoMedioMaterial: 0 });
  });

  it('tolera campos ausentes', () => {
    const t = calcularTotaisFrete([{}, { pesoToneladas: 10, valorMaterial: 1000 }]);
    expect(t.peso).toBe(10);
    expect(t.precoMedioMaterial).toBeCloseTo(100, 6);
  });
});
