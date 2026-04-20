-- Tipo de origem do combustível: tanque, dinheiro, requisicao
ALTER TABLE abastecimentos ADD COLUMN IF NOT EXISTS origem_combustivel text NOT NULL DEFAULT 'tanque';
ALTER TABLE abastecimentos ADD COLUMN IF NOT EXISTS fornecedor text NOT NULL DEFAULT '';
ALTER TABLE abastecimentos ADD COLUMN IF NOT EXISTS pago boolean NOT NULL DEFAULT false;
ALTER TABLE abastecimentos ADD COLUMN IF NOT EXISTS data_pagamento text NOT NULL DEFAULT '';
ALTER TABLE abastecimentos ADD COLUMN IF NOT EXISTS pago_por text NOT NULL DEFAULT '';

-- Permitir deposito_id nulo (para dinheiro/requisicao)
ALTER TABLE abastecimentos ALTER COLUMN deposito_id DROP NOT NULL;

-- Atualizar trigger para lidar com deposito_id nulo
CREATE OR REPLACE FUNCTION trigger_abastecimento_nivel()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.deposito_id IS NOT NULL THEN
      PERFORM recalcular_nivel_deposito(OLD.deposito_id);
    END IF;
    RETURN OLD;
  END IF;
  IF NEW.deposito_id IS NOT NULL THEN
    PERFORM recalcular_nivel_deposito(NEW.deposito_id);
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.deposito_id IS DISTINCT FROM NEW.deposito_id AND OLD.deposito_id IS NOT NULL THEN
    PERFORM recalcular_nivel_deposito(OLD.deposito_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
