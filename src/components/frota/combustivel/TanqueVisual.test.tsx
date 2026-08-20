import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import TanqueVisual from './TanqueVisual';

// Regressão do print de 20/08/2026: o card da aba Tanques mostrava "156 L"
// pro Tanque Canteiro 2, que tem 155,600 L no banco.
describe('TanqueVisual — nível com 2 casas', () => {
  it('LINHA DE CONTROLE: 155,6 L aparece como 155,60 e nunca como 156', () => {
    const { container } = render(
      <TanqueVisual
        nome="Tanque Canteiro 2"
        capacidadeLitros={15000}
        nivelAtualLitros={155.6}
        combustivelNome="Diesel S10"
      />,
    );
    const texto = container.textContent ?? '';
    expect(texto).toContain('155,60 L');
    expect(texto).not.toContain('156 L');
  });

  it('valor redondo mostra ,00 e a capacidade fica sem casas', () => {
    const { container } = render(
      <TanqueVisual
        nome="ARLA GREGÓRIO"
        capacidadeLitros={4000}
        nivelAtualLitros={1880}
        combustivelNome="Arla"
      />,
    );
    const texto = container.textContent ?? '';
    expect(texto).toContain('1.880,00 L');
    expect(texto).toContain('47% de 4.000 L');
  });

  it('tanque vazio mostra 0,00 L', () => {
    const { container } = render(
      <TanqueVisual nome="Tanque Patio Colorado" capacidadeLitros={15000} nivelAtualLitros={0} />,
    );
    expect(container.textContent ?? '').toContain('0,00 L');
  });
});
