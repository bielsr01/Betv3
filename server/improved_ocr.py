#!/usr/bin/env python3
"""
Sistema OCR melhorado para BetTracker usando pytesseract.image_to_data
Baseado na pesquisa do usuário para extração confiável de dados de apostas
"""

import sys
import json
import base64
import io
import re
# import pandas as pd  # Removido para simplificar
import pytesseract
from PIL import Image, ImageEnhance, ImageFilter
import tempfile
import os

def preprocessar_imagem(img):
    """
    Pré-processamento otimizado para preservar texto
    """
    try:
        # Redimensionar se muito grande
        width, height = img.size
        if width > 2000 or height > 2000:
            ratio = min(2000/width, 2000/height)
            new_width = int(width * ratio)
            new_height = int(height * ratio)
            img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
            print(f"Imagem redimensionada para {new_width}x{new_height}", file=sys.stderr)
        
        # Converte para RGB primeiro
        if img.mode != 'RGB':
            img = img.convert('RGB')
        
        # Aplicar contraste moderado (menos agressivo)
        enhancer = ImageEnhance.Contrast(img)
        img = enhancer.enhance(1.5)  # Reduzido de 2.0 para 1.5
        
        # Converte para escala de cinza
        img = img.convert('L')
        
        # Aplicar sharpening leve
        enhancer = ImageEnhance.Sharpness(img)
        img = enhancer.enhance(1.2)
        
        # SEM binarização agressiva - manter tons de cinza
        # Aplicar apenas um threshold mais suave se necessário
        # img = img.point(lambda x: 0 if x < 100 else 255, mode='1')  # REMOVIDO
        
        return img
        
    except Exception as e:
        print(f"Erro no pré-processamento: {e}", file=sys.stderr)
        return img

def extrair_dados_surebet(img):
    """
    Processa imagem de aposta usando pytesseract.image_to_data
    e retorna dados estruturados
    """
    try:
        # Etapa 1: Pré-processamento da imagem
        img_processed = preprocessar_imagem(img)
        
        # Etapa 2: Execução do OCR com image_to_data para obter coordenadas
        print("Iniciando OCR com image_to_data...", file=sys.stderr)
        
        # Configuração otimizada do Tesseract para capturas de tela
        custom_config = r'--oem 3 --psm 3 -c tessedit_char_whitelist=0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÀÁÂÃÄÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝàáâãäçèéêëìíîïñòóôõöùúûüý().,/:-_%&$'
        
        # OCR com dados detalhados (usar dicionário ao invés de DataFrame)
        dados_ocr = pytesseract.image_to_data(
            img_processed, 
            output_type=pytesseract.Output.DICT,
            config=custom_config
        )
        
        print(f"OCR processou {len(dados_ocr['text'])} elementos", file=sys.stderr)
        
        # Etapa 3: Filtrar por confiança e agrupar em linhas
        linhas_agrupadas = {}
        
        # Iterar sobre os dados usando índices
        for i in range(len(dados_ocr['text'])):
            conf = dados_ocr['conf'][i]
            text = str(dados_ocr['text'][i]).strip()
            level = dados_ocr['level'][i]
            
            # Filtrar por confiança mais baixa e incluir mais níveis
            if conf > 15 and text and level >= 4:  # Level 4+ = palavra ou linha
                y_coord = dados_ocr['top'][i]
                
                # Agrupa palavras que estão na mesma linha (±15 pixels)
                linha_encontrada = False
                for y_existente in linhas_agrupadas.keys():
                    if abs(y_coord - y_existente) <= 15:
                        linhas_agrupadas[y_existente].append({
                            'text': text,
                            'conf': conf,
                            'left': dados_ocr['left'][i],
                            'top': dados_ocr['top'][i],
                            'width': dados_ocr['width'][i],
                            'height': dados_ocr['height'][i]
                        })
                        linha_encontrada = True
                        break
                
                if not linha_encontrada:
                    linhas_agrupadas[y_coord] = [{
                        'text': text,
                        'conf': conf,
                        'left': dados_ocr['left'][i],
                        'top': dados_ocr['top'][i],
                        'width': dados_ocr['width'][i],
                        'height': dados_ocr['height'][i]
                    }]
        
        print(f"Elementos filtrados com confiança > 30%: {len(linhas_agrupadas)}", file=sys.stderr)
        
        # Converter linhas em texto ordenado por posição horizontal
        linhas_texto = []
        for y in sorted(linhas_agrupadas.keys()):
            palavras_ordenadas = sorted(linhas_agrupadas[y], key=lambda x: x['left'])
            texto_linha = ' '.join([p['text'] for p in palavras_ordenadas if p['text']])
            if texto_linha.strip():
                linhas_texto.append({
                    'y_pos': y,
                    'text': texto_linha,
                    'words': palavras_ordenadas,
                    'avg_conf': sum([p['conf'] for p in palavras_ordenadas]) / len(palavras_ordenadas)
                })
        
        print(f"Linhas de texto processadas: {len(linhas_texto)}", file=sys.stderr)
        
        # Etapa 4: Extração com regex
        apostas_extraidas = extrair_apostas_com_regex(linhas_texto)
        
        return {
            'success': True,
            'total_lines': len(linhas_texto),
            'processed_lines': linhas_texto,
            'apostas_extraidas': apostas_extraidas,
            'raw_text': ' '.join([linha['text'] for linha in linhas_texto])
        }
        
    except Exception as e:
        print(f"Erro na extração de dados: {e}", file=sys.stderr)
        return {
            'success': False,
            'error': str(e),
            'total_lines': 0,
            'processed_lines': [],
            'apostas_extraidas': {
                'betA': {},
                'betB': {},
                'game_info': {}
            },
            'raw_text': ''
        }

def extrair_apostas_com_regex(linhas_texto):
    """
    Extrai dados de apostas usando regex otimizado
    """
    betA = {'bettingHouse': '', 'teamA': '', 'teamB': '', 'betType': '', 'odds': '', 'stake': '', 'payout': '', 'selectedSide': 'A'}
    betB = {'bettingHouse': '', 'teamA': '', 'teamB': '', 'betType': '', 'odds': '', 'stake': '', 'payout': '', 'selectedSide': 'B'}
    game_info = {'gameDate': '', 'sport': 'Futebol', 'totalProfit': ''}
    
    casas_apostas = ['KTO', 'Pinnacle', 'Bet365', 'Betfair', 'Sportsbet', 'Betano', 'Rivalo', 'Betway', 'BravoBet', 'Blaze']
    
    print("Iniciando extração com regex...", file=sys.stderr)
    
    for linha in linhas_texto:
        texto = linha['text']
        print(f"Analisando linha: {texto[:100]}...", file=sys.stderr)
        
        # Detectar casas de apostas
        for casa in casas_apostas:
            if casa.lower() in texto.lower():
                print(f"Casa encontrada: {casa}", file=sys.stderr)
                
                # Extrair números (odds, stake, payout) da mesma linha
                numeros = re.findall(r'\d+\.?\d*', texto)
                numeros_float = []
                for num in numeros:
                    try:
                        if '.' in num:
                            numeros_float.append(float(num))
                        else:
                            numeros_float.append(int(num))
                    except:
                        continue
                
                print(f"Números encontrados: {numeros_float}", file=sys.stderr)
                
                # Atribuir à primeira aposta vazia
                if not betA['bettingHouse']:
                    betA['bettingHouse'] = casa
                    if len(numeros_float) >= 2:
                        # Primeiro número > 1 = odds, segundo = stake 
                        for i, num in enumerate(numeros_float):
                            if num > 1.0 and not betA['odds']:
                                betA['odds'] = str(num)
                                if i + 1 < len(numeros_float):
                                    betA['stake'] = str(numeros_float[i + 1])
                                break
                    
                    # Extrair tipo de aposta
                    if 'DNB' in texto:
                        betA['betType'] = 'DNB'
                    elif 'H1' in texto:
                        betA['betType'] = 'H1'
                    elif 'H2' in texto:
                        betA['betType'] = 'H2'
                    elif '1/' in texto:
                        betA['betType'] = '1/ DNB'
                        
                elif not betB['bettingHouse']:
                    betB['bettingHouse'] = casa
                    if len(numeros_float) >= 2:
                        for i, num in enumerate(numeros_float):
                            if num > 1.0 and not betB['odds']:
                                betB['odds'] = str(num)
                                if i + 1 < len(numeros_float):
                                    betB['stake'] = str(numeros_float[i + 1])
                                break
                    
                    # Extrair tipo de aposta
                    if 'DNB' in texto:
                        betB['betType'] = 'DNB'
                    elif 'H1' in texto:
                        betB['betType'] = 'H1'  
                    elif 'H2' in texto:
                        betB['betType'] = 'H2'
                    elif '0)' in texto:
                        betB['betType'] = 'H2(0)'
        
        # Extrair times (formato: Time A — Time B ou Time A - Time B)
        team_match = re.search(r'([A-Za-zÀ-ÿ\s]+)\s*[—-]\s*([A-Za-zÀ-ÿ\s]+)', texto)
        if team_match and not betA['teamA']:
            betA['teamA'] = team_match.group(1).strip()
            betA['teamB'] = team_match.group(2).strip()
            betB['teamA'] = betA['teamA']
            betB['teamB'] = betA['teamB']
            print(f"Times encontrados: {betA['teamA']} vs {betA['teamB']}", file=sys.stderr)
        
        # Extrair lucro total
        profit_match = re.search(r'(\d+\.?\d*)%', texto)
        if profit_match:
            game_info['totalProfit'] = profit_match.group(1)
            print(f"Lucro encontrado: {game_info['totalProfit']}%", file=sys.stderr)
        
        # Extrair data
        date_match = re.search(r'(\d{4}-\d{2}-\d{2})', texto)
        if date_match:
            game_info['gameDate'] = date_match.group(1)
        elif re.search(r'(\d{2}/\d{2})', texto):
            date_match = re.search(r'(\d{2}/\d{2})', texto)
            game_info['gameDate'] = f"2025-{date_match.group(1).replace('/', '-')}"
    
    # Calcular payouts se odds e stake estão disponíveis
    if betA['odds'] and betA['stake']:
        try:
            betA['payout'] = str(round(float(betA['odds']) * float(betA['stake']), 2))
        except:
            pass
    
    if betB['odds'] and betB['stake']:
        try:
            betB['payout'] = str(round(float(betB['odds']) * float(betB['stake']), 2))
        except:
            pass
    
    # Data padrão se não encontrada
    if not game_info['gameDate']:
        from datetime import datetime
        game_info['gameDate'] = datetime.now().strftime('%Y-%m-%d')
    
    print(f"Extração concluída - BetA: {betA['bettingHouse']}, BetB: {betB['bettingHouse']}", file=sys.stderr)
    
    return {
        'betA': betA,
        'betB': betB,
        'game_info': game_info
    }

def main():
    """
    Função principal para processar imagem via linha de comando
    """
    try:
        # Lê imagem base64 da entrada padrão
        input_data = sys.stdin.read().strip()
        data = json.loads(input_data)
        
        image_base64 = data.get('imageBase64', '')
        if not image_base64:
            raise ValueError("imageBase64 é obrigatório")
        
        # Remove prefixo data URL se presente
        if ',' in image_base64:
            image_base64 = image_base64.split(',')[1]
        
        # Decodifica base64 para imagem
        image_data = base64.b64decode(image_base64)
        img = Image.open(io.BytesIO(image_data))
        
        print(f"Processando imagem {img.size}...", file=sys.stderr)
        
        # Processa imagem
        resultado = extrair_dados_surebet(img)
        
        # Retorna resultado
        print(json.dumps(resultado))
        
    except Exception as e:
        print(f"Erro no processamento principal: {e}", file=sys.stderr)
        error_result = {
            'success': False,
            'error': str(e),
            'total_lines': 0,
            'processed_lines': [],
            'apostas_extraidas': {
                'betA': {},
                'betB': {},
                'game_info': {}
            },
            'raw_text': ''
        }
        print(json.dumps(error_result))
        sys.exit(1)

if __name__ == "__main__":
    main()