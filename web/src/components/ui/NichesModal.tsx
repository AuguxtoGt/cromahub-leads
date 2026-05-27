import { useState } from 'react';
import { Lightbulb, X, Search, Zap, Flame, Target } from 'lucide-react';

const NICHES = [
  {
    category: "Alta Concorrência (Mas com Muito Dinheiro)",
    icon: <Flame className="w-5 h-5 text-red-500" />,
    description: "Precisam de uma landing page premium para se destacar. Cobrar R$297 a R$497 aqui é muito fácil se a página for linda.",
    items: [
      "Dentistas (Implantes, Invisalign)", "Harmonização Facial", "Advogados (Previdenciário, Família)",
      "Corretores de Imóveis Alto Padrão", "Clínicas de Estética", "Cirurgiões Plásticos",
      "Nutricionistas Esportivos", "Contadores para Médicos", "Academias Premium / Crossfit",
      "Concessionárias de Seminovos", "Psicólogos / Terapia Online", "Dermatologistas",
      "Escritórios de Arquitetura", "Designers de Interiores", "Consultórios de Fisioterapia",
      "Clínicas de Psicologia", "Empresas de Energia Solar", "Clínicas de Emagrecimento",
      "Personal Trainers Premium", "Pilates e Yoga"
    ]
  },
  {
    category: "Média Concorrência (Ótimo Custo-Benefício)",
    icon: <Zap className="w-5 h-5 text-orange-500" />,
    description: "Já entendem a importância da internet, mas as páginas deles costumam ser horríveis ou usam apenas Instagram.",
    items: [
      "Clínicas Veterinárias", "Pet Shops com Banho e Tosa", "Instalação de Ar Condicionado",
      "Oficinas Mecânicas Premium", "Lojas de Móveis Planejados", "Empresas de Segurança / CFTV",
      "Escolas de Idiomas Locais", "Clínicas de Vacinação", "Lava Rápido / Estética Automotiva",
      "Autoescolas", "Serviços de Buffet e Eventos", "Empresas de Limpeza Terceirizada",
      "Agências de Turismo", "Aluguel de Equipamentos", "Assessorias de Casamento",
      "Vidraçarias", "Marmorarias e Granitos", "Lojas de Piscinas", "Decoração de Festas",
      "Escolas de Música", "Distribuidoras de Bebidas", "Barbearias Premium", 
      "Estúdios de Tatuagem", "Corretoras de Seguros", "Oficinas de Funilaria e Pintura"
    ]
  },
  {
    category: "Oceano Azul / Baixa Concorrência (Venda Certa)",
    icon: <Target className="w-5 h-5 text-blue-500" />,
    description: "Pouquíssima concorrência digital. Quando eles fazem um site, geralmente dominam a região no Google Meu Negócio.",
    items: [
      "Desentupidoras", "Locação de Caçambas", "Dedetizadoras / Controle de Pragas",
      "Empresas de Mudanças / Carretos", "Chaveiros 24 horas", "Guinchos e Reboques",
      "Assistência Técnica (Geladeira/Máquina)", "Conserto de Celulares/Notebooks",
      "Instalação de Redes de Proteção", "Eletricistas Residenciais/Prediais",
      "Encanadores / Caça Vazamentos", "Pintores Profissionais", "Gesseiros e Drywall",
      "Marceneiros Independentes", "Serralherias", "Instaladores de Papel de Parede",
      "Lavagem de Estofados / Sofás", "Impermeabilização de Estofados", "Limpeza de Caixas D'água",
      "Perfuradores de Poços Artesianos", "Montadores de Móveis", "Aluguel de Andaimes",
      "Borracharias 24h", "Fabricantes de Toldos", "Instaladores de Calhas",
      "Retíficas de Motores", "Tapeçarias", "Empresas de Terraplanagem",
      "Caminhão Pipa", "Disk Caçamba", "Fornecedores de Grama", "Empresas de Paisagismo"
    ]
  }
];

export function NichesModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [searchTerm, setSearchTerm] = useState("");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 relative z-10">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg shadow-inner">
              <Lightbulb className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Ideias de Nichos para Prospecção</h2>
              <p className="text-sm text-gray-500 font-medium">Mais de 100 mercados altamente lucrativos</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-white/50 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-100 bg-gray-50/50">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Buscar por nicho específico..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
            />
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex flex-col gap-8">
          {NICHES.map((section, idx) => {
            const filteredItems = section.items.filter(item => 
              item.toLowerCase().includes(searchTerm.toLowerCase())
            );

            if (filteredItems.length === 0) return null;

            return (
              <div key={idx} className="animate-in fade-in duration-500" style={{ animationDelay: \`\${idx * 100}ms\` }}>
                <div className="flex items-center gap-2 mb-2">
                  {section.icon}
                  <h3 className="text-lg font-bold text-gray-900">{section.category}</h3>
                </div>
                <p className="text-sm text-gray-500 mb-4 ml-7">{section.description}</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 ml-7">
                  {filteredItems.map((item, i) => (
                    <div 
                      key={i} 
                      className="px-3 py-2 bg-gray-50 hover:bg-blue-50 border border-gray-100 hover:border-blue-100 rounded-lg text-sm text-gray-700 hover:text-blue-700 transition-colors cursor-default flex items-center gap-2 group"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-300 group-hover:bg-blue-400 transition-colors" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {searchTerm && !NICHES.some(s => s.items.some(i => i.toLowerCase().includes(searchTerm.toLowerCase()))) && (
            <div className="text-center py-12">
              <p className="text-gray-500 font-medium">Nenhum nicho encontrado com "{searchTerm}"</p>
              <p className="text-sm text-gray-400 mt-1">Tente buscar por palavras mais gerais.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl text-center">
          <p className="text-xs font-medium text-gray-500">
            Dica: Combine o nicho com uma região rica da sua cidade para melhores resultados (Ex: "Desentupidora em Moema SP").
          </p>
        </div>
      </div>
    </div>
  );
}
