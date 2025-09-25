import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Upload, Clipboard, Loader2, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const TestUpload = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [rawResult, setRawResult] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Handle paste events (Ctrl+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            handleFileUpload(file);
          }
          break;
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, []);

  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Arquivo inválido',
        description: 'Por favor selecione um arquivo de imagem.',
        variant: 'destructive'
      });
      return;
    }

    setIsProcessing(true);
    setRawResult('');

    try {
      // Convert file to base64
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Remove data:image/png;base64, prefix  
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.readAsDataURL(file);
      });

      // Call backend API for RAW OCR.space result
      const response = await fetch('/api/ocr/raw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageBase64: base64 }),
      });

      if (!response.ok) {
        throw new Error('Falha ao processar imagem');
      }

      const rawData = await response.text();
      setRawResult(rawData);

      toast({
        title: 'Sucesso!',
        description: 'Imagem processada com Perplexity AI',
      });

    } catch (error) {
      console.error('OCR processing failed:', error);
      toast({
        title: 'Erro no processamento',
        description: 'Falha ao processar imagem com Perplexity AI. Tente novamente.',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Teste Upload Perplexity OCR</h1>
        <p className="text-muted-foreground">
          Teste o Perplexity AI diretamente - texto real extraído sem formatação
        </p>
      </div>

      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload de Imagem
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-primary/50'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileInputChange}
              className="hidden"
              data-testid="input-file-upload"
            />
            
            {isProcessing ? (
              <div className="flex flex-col items-center space-y-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-lg font-medium">Processando com Perplexity AI...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-4">
                <div className="flex gap-4">
                  <Upload className="h-12 w-12 text-muted-foreground" />
                  <Clipboard className="h-12 w-12 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  <p className="text-lg font-medium">
                    Arraste uma imagem ou clique para selecionar
                  </p>
                  <p className="text-muted-foreground">
                    Ou use <kbd className="px-2 py-1 bg-muted rounded text-sm">Ctrl+V</kbd> para colar uma imagem
                  </p>
                </div>
                <Button 
                  onClick={openFileDialog}
                  className="mt-4"
                  data-testid="button-upload"
                >
                  Selecionar Arquivo
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results Area */}
      {rawResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Texto Extraído do Perplexity AI
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={rawResult}
              readOnly
              className="min-h-96 font-mono text-sm"
              placeholder="O texto extraído do Perplexity AI aparecerá aqui..."
              data-testid="textarea-raw-result"
            />
            <div className="mt-4 flex gap-2">
              <Button
                variant="outline"
                onClick={() => navigator.clipboard.writeText(rawResult)}
                data-testid="button-copy-result"
              >
                Copiar Resultado
              </Button>
              <Button
                variant="outline"  
                onClick={() => setRawResult('')}
                data-testid="button-clear-result"
              >
                Limpar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TestUpload;