import { novaLinhaVazia } from '../types/calculo';
import type { ElementoPrancha, ElementoTipo, FormaTipo, Viewport } from '../types/prancha';

const DEFAULTS: Record<ElementoTipo, { largura: number; altura: number }> = {
  texto: { largura: 220, altura: 60 },
  calculo: { largura: 260, altura: 80 },
  forma: { largura: 140, altura: 90 },
};

export interface NovoElementoOpts {
  formaTipo?: FormaTipo;
}

export function novoElemento(tipo: ElementoTipo, x: number, y: number, opts: NovoElementoOpts = {}): ElementoPrancha {
  const base = DEFAULTS[tipo];
  let largura = base.largura;
  let altura = base.altura;
  let props: ElementoPrancha['props'];

  if (tipo === 'texto') {
    props = { texto: '' };
  } else if (tipo === 'calculo') {
    props = { linhas: [novaLinhaVazia(0)], alertaAtivo: true };
  } else {
    const formaTipo = opts.formaTipo ?? 'retangulo';
    if (formaTipo === 'quadrado' || formaTipo === 'circulo') {
      altura = largura;
    }
    if (formaTipo === 'linha') {
      altura = 0;
    }
    props = { formaTipo, cor: '#5b8def', espessura: 2 };
  }

  return {
    id: crypto.randomUUID(),
    tipo,
    x,
    y,
    largura,
    altura,
    rotacao: 0,
    z: Date.now(),
    props,
  };
}

/** Converte um ponto da tela (clientX/Y) pro espaço do canvas, considerando pan+zoom. */
export function telaParaCanvas(
  clientX: number,
  clientY: number,
  rect: Pick<DOMRect, 'left' | 'top'>,
  viewport: Viewport,
): { x: number; y: number } {
  return {
    x: (clientX - rect.left - viewport.x) / viewport.zoom,
    y: (clientY - rect.top - viewport.y) / viewport.zoom,
  };
}
