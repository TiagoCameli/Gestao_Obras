UPDATE abastecimentos_carreta SET mes_referencia = LEFT(data, 7) WHERE mes_referencia = '' AND data != '';
