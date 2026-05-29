import { useRef, useState, useCallback } from 'react';
import Moveable from 'react-moveable';
import { PranchaToolbar, type Ferramenta } from './PranchaToolbar';
import { ElementoTexto } from './ElementoTexto';
import { ElementoForma } from './ElementoForma';
import { ElementoCalculo } from './ElementoCalculo';
import { novoElemento, telaParaCanvas } from '../../services/pranchaModel';
import type {
  DocumentoPrancha, ElementoPrancha, FormaTipo,
  PropsTexto, PropsCalculo, PropsForma,
} from '../../types/prancha';

const FORMAS: Record<string, FormaTipo> = {
  linha: 'linha', retangulo: 'retangulo', quadrado: 'quadrado', circulo: 'circulo',
};

interface Props {
  documento: DocumentoPrancha;
  readOnly: boolean;
  onChange: (doc: DocumentoPrancha) => void;
}

export function PranchaCanvas({ documento, readOnly, onChange }: Props) {
  const [ferramenta, setFerramenta] = useState<Ferramenta>('selecionar');
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const elementoRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const { viewport, elementos } = documento;

  const setElementos = useCallback((novos: ElementoPrancha[]) => {
    onChange({ ...documento, elementos: novos });
  }, [documento, onChange]);

  const atualizarElemento = useCallback((id: string, patch: Partial<ElementoPrancha>) => {
    setElementos(elementos.map((el) => (el.id === id ? { ...el, ...patch } : el)));
  }, [elementos, setElementos]);

  function handleCanvasClick(e: React.MouseEvent) {
    if (readOnly) return;
    if (ferramenta === 'selecionar' || ferramenta === 'mao') {
      if (e.target === canvasRef.current) setSelecionadoId(null);
      return;
    }
    const rect = canvasRef.current!.getBoundingClientRect();
    const { x, y } = telaParaCanvas(e.clientX, e.clientY, rect, viewport);
    let el: ElementoPrancha;
    if (ferramenta === 'texto') el = novoElemento('texto', x, y);
    else if (ferramenta === 'calculo') el = novoElemento('calculo', x, y);
    else el = novoElemento('forma', x, y, { formaTipo: FORMAS[ferramenta] });
    setElementos([...elementos, el]);
    setSelecionadoId(el.id);
    setFerramenta('selecionar');
  }

  function apagarSelecionado() {
    if (!selecionadoId) return;
    setElementos(elementos.filter((el) => el.id !== selecionadoId));
    setSelecionadoId(null);
  }

  function renderProps(el: ElementoPrancha) {
    const onPropsChange = (props: ElementoPrancha['props']) => atualizarElemento(el.id, { props });
    if (el.tipo === 'texto') return <ElementoTexto props={el.props as PropsTexto} readOnly={readOnly} onChange={onPropsChange} />;
    if (el.tipo === 'calculo') return <ElementoCalculo props={el.props as PropsCalculo} readOnly={readOnly} onChange={onPropsChange} />;
    return <ElementoForma props={el.props as PropsForma} largura={el.largura} altura={el.altura} />;
  }

  const selecionado = elementos.find((el) => el.id === selecionadoId) ?? null;

  return (
    <div className="flex flex-1 min-h-0">
      <PranchaToolbar
        ativa={ferramenta}
        onSelecionar={setFerramenta}
        onApagar={apagarSelecionado}
        podeApagar={!!selecionadoId}
        disabled={readOnly}
      />
      <div
        ref={canvasRef}
        onClick={handleCanvasClick}
        data-testid="prancha-canvas"
        className="relative flex-1 overflow-hidden bg-background"
        style={{
          cursor: ferramenta === 'selecionar' ? 'default' : ferramenta === 'mao' ? 'grab' : 'crosshair',
          backgroundImage: 'radial-gradient(var(--color-border) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
      >
        <div style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`, transformOrigin: '0 0' }}>
          {elementos.map((el) => (
            <div
              key={el.id}
              ref={(node) => { if (node) elementoRefs.current.set(el.id, node); else elementoRefs.current.delete(el.id); }}
              onClick={(e) => { e.stopPropagation(); if (ferramenta === 'selecionar') setSelecionadoId(el.id); }}
              style={{
                position: 'absolute',
                left: el.x, top: el.y, width: el.largura, height: el.altura,
                transform: `rotate(${el.rotacao}deg)`,
                outline: el.id === selecionadoId ? '1px solid var(--color-primary, #2563eb)' : 'none',
              }}
            >
              {renderProps(el)}
            </div>
          ))}
        </div>

        {!readOnly && selecionado && (
          <Moveable
            target={elementoRefs.current.get(selecionado.id) ?? null}
            draggable
            resizable
            rotatable
            throttleDrag={0}
            onDrag={({ left, top }) => atualizarElemento(selecionado.id, { x: left / viewport.zoom, y: top / viewport.zoom })}
            onResize={({ width, height, drag }) => atualizarElemento(selecionado.id, {
              largura: width / viewport.zoom,
              altura: height / viewport.zoom,
              x: drag.left / viewport.zoom,
              y: drag.top / viewport.zoom,
            })}
            onRotate={({ beforeRotation }) => atualizarElemento(selecionado.id, { rotacao: beforeRotation })}
          />
        )}
      </div>
    </div>
  );
}
