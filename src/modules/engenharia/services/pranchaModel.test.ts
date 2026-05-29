import { describe, it, expect } from 'vitest';
import { novoElemento, telaParaCanvas } from './pranchaModel';
import type { PropsCalculo, PropsForma } from '../types/prancha';

describe('pranchaModel.novoElemento', () => {
  it('cria caixa de texto vazia com tamanho default', () => {
    const el = novoElemento('texto', 100, 50);
    expect(el.tipo).toBe('texto');
    expect(el.x).toBe(100);
    expect(el.y).toBe(50);
    expect(el.largura).toBeGreaterThan(0);
    expect((el.props as { texto: string }).texto).toBe('');
  });

  it('cria caixa de cálculo com uma linha vazia e alerta ativo', () => {
    const el = novoElemento('calculo', 0, 0);
    const props = el.props as PropsCalculo;
    expect(props.linhas).toHaveLength(1);
    expect(props.alertaAtivo).toBe(true);
  });

  it('cria forma com formaTipo passado em opts', () => {
    const el = novoElemento('forma', 0, 0, { formaTipo: 'circulo' });
    expect((el.props as PropsForma).formaTipo).toBe('circulo');
  });

  it('quadrado nasce com largura igual à altura', () => {
    const el = novoElemento('forma', 0, 0, { formaTipo: 'quadrado' });
    expect(el.largura).toBe(el.altura);
  });
});

describe('pranchaModel.telaParaCanvas', () => {
  it('converte coordenada de tela pra espaço do canvas considerando pan e zoom', () => {
    const ponto = telaParaCanvas(150, 120, { left: 0, top: 0 } as DOMRect, { x: 50, y: 20, zoom: 2 });
    expect(ponto.x).toBe(50);
    expect(ponto.y).toBe(50);
  });
});
