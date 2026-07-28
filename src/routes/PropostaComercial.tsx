import { useState } from "react";
import {
  FileText,
  ShieldCheck,
  Building2,
  Printer,
  Share2,
  Phone,
  Calendar,
  Layers,
  Lock,
  Compass,
  Zap,
} from "lucide-react";

export default function PropostaComercial() {
  const [qtdAlunos, setQtdAlunos] = useState<number>(1500);
  const [copiado, setCopiado] = useState(false);
  const [secaoAtiva, setSecaoAtiva] = useState<"resumo" | "modulos" | "governanca" | "roi">("resumo");

  // Cálculos de impacto financeiro e operacional
  const economiaEstimada = (qtdAlunos * 16.8).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
  const horasServidores = Math.round(qtdAlunos * 0.4);
  const vagasRecuperadas = Math.round(qtdAlunos * 0.15);

  function compartilharLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  }

  function imprimir() {
    window.print();
  }

  return (
    <div className="min-h-screen bg-[#090E17] text-slate-200 font-sans antialiased selection:bg-blue-600 selection:text-white print:bg-white print:text-slate-900">
      {/* NAVEGAÇÃO / HEADER EXECUTIVO FIXO (Oculto na impressão) */}
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-[#090E17]/90 backdrop-blur-md print:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <img
              src="/sysbus-logo.png"
              alt="SYSBUS Logo"
              className="h-8 w-auto object-contain rounded-lg border border-slate-800"
            />
            <div className="hidden sm:block border-l border-slate-800 pl-3">
              <p className="text-xs font-semibold tracking-wide text-slate-100 uppercase">SYSBUS 2.0</p>
              <p className="text-[11px] text-slate-400">VannTec · Tecnologia para a Gestão Pública</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={compartilharLink}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
            >
              <Share2 className="h-3.5 w-3.5 text-slate-400" />
              {copiado ? "Link Copiado" : "Compartilhar Link"}
            </button>
            <button
              onClick={imprimir}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
            >
              <Printer className="h-3.5 w-3.5 text-slate-400" />
              Imprimir / PDF
            </button>
            <a
              href="#solicitar"
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-500"
            >
              Solicitar Reunião
            </a>
          </div>
        </div>
      </header>

      {/* DOCUMENT CONTAINER */}
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12 print:p-0 print:max-w-none">
        {/* CABEÇALHO DO DOCUMENTO INSTITUCIONAL */}
        <div className="rounded-xl border border-slate-800 bg-[#0F172A]/70 p-6 sm:p-10 mb-8 print:border-slate-300 print:bg-white print:p-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-800/80 pb-6 gap-4 print:border-slate-300">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-950/80 border border-blue-800/50 px-2.5 py-1 text-[11px] font-semibold text-blue-400 print:bg-slate-100 print:text-slate-800 print:border-slate-300">
                DOCUMENTO EXECUTIVO B2G · REF. 2026-GOV
              </span>
              <h1 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-4xl print:text-slate-900">
                Apresentação Comercial & Técnica: SYSBUS 2.0
              </h1>
              <p className="mt-2 text-sm text-slate-400 print:text-slate-600">
                Plataforma SaaS para Automação do Transporte Escolar, Controle de Frotas e Carteirinhas Digitais Municipais.
              </p>
            </div>
            <div className="text-left sm:text-right shrink-0 text-xs text-slate-400 space-y-1 print:text-slate-600">
              <p><strong className="text-slate-200 print:text-slate-900">Emissor:</strong> VannTec Soluções</p>
              <p><strong className="text-slate-200 print:text-slate-900">Destino:</strong> Administração Pública Municipal</p>
              <p><strong className="text-slate-200 print:text-slate-900">Status:</strong> Proposta de Implantação / Piloto</p>
            </div>
          </div>

          {/* MENUS DE NAVEGAÇÃO RÁPIDA (DOCUMENT TABS) */}
          <div className="mt-6 flex flex-wrap gap-2 print:hidden border-b border-slate-800/60 pb-4">
            <button
              onClick={() => setSecaoAtiva("resumo")}
              className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-colors ${
                secaoAtiva === "resumo"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-900/80 text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              1. Carta Executiva & Origem
            </button>
            <button
              onClick={() => setSecaoAtiva("modulos")}
              className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-colors ${
                secaoAtiva === "modulos"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-900/80 text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              2. Módulos & Diagnóstico Operacional
            </button>
            <button
              onClick={() => setSecaoAtiva("governanca")}
              className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-colors ${
                secaoAtiva === "governanca"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-900/80 text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              3. Governança, RLS & Segurança
            </button>
            <button
              onClick={() => setSecaoAtiva("roi")}
              className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-colors ${
                secaoAtiva === "roi"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-900/80 text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              4. Impacto Financeiro & Piloto
            </button>
          </div>

          {/* CARTA EXECUTIVA DO FUNDADOR / ORIGEM DO SISTEMA */}
          <div className="mt-6 space-y-4">
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2 print:text-slate-900">
              <FileText className="h-4 w-4 text-blue-400 print:text-slate-700" />
              Carta de Apresentação ao Prefeito e Secretários Municipais
            </h2>
            <div className="rounded-lg border border-slate-800 bg-[#0B132B]/50 p-5 text-xs text-slate-300 leading-relaxed space-y-3 print:border-slate-300 print:bg-slate-50 print:text-slate-800">
              <p>
                <strong>Prezado(a) Gestor(a) Público(a),</strong>
              </p>
              <p>
                A gestão do transporte público escolar e universitário é um dos desafios operacionais mais sensíveis de qualquer município. Ela envolve diretamente a segurança de estudantes, o orçamento de combustível da frota, o cumprimento das normas do FNDE/PNATE e a percepção de eficiência da administração perante a população.
              </p>
              <p>
                O <strong>SYSBUS 2.0</strong> não foi concebido como um software genérico de prateleira. Sua lógica de funcionamento foi estruturada a partir da <strong>vivência real de quem sentiu as falhas do transporte na pele como estudante</strong> — enfrentando incertezas nas paradas, filas desorganizadas e carteirinhas de papel que rasgavam — combinada com o rigor técnico exigido pelas Secretarias de Educação e Transportes.
              </p>
              <p>
                Trata-se de uma solução que atende simultaneamente às duas pontas: entrega conveniência e agilidade ao estudante no smartphone, enquanto oferece à prefeitura controle absoluto sobre matrículas, itinerários, motoristas e validação de embarque.
              </p>
            </div>
          </div>
        </div>

        {/* DIAGNÓSTICO OPERACIONAL: MATRIZ ANTES X DEPOIS */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 print:text-slate-900">
              <Compass className="h-5 w-5 text-blue-400" />
              Diagnóstico Operacional: Da Gestão Manual à Era Digital
            </h2>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-800 bg-[#0F172A]/70 print:border-slate-300 print:bg-white">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-300 font-semibold print:bg-slate-100 print:text-slate-900 print:border-slate-300">
                  <th className="p-3.5 w-1/2 border-r border-slate-800 print:border-slate-300">Cenário Tradicional (Processo Manual)</th>
                  <th className="p-3.5 w-1/2 text-blue-300 print:text-blue-900">Solução com SYSBUS 2.0</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300 print:divide-slate-200 print:text-slate-800">
                <tr>
                  <td className="p-3.5 border-r border-slate-800/60 text-slate-400 print:border-slate-200 print:text-slate-600">
                    Emissão física de carteirinhas de papel ou PVC que estragam e geram filas na secretaria.
                  </td>
                  <td className="p-3.5 font-medium text-slate-200 print:text-slate-900">
                    Credencial digital instantânea no smartphone com QR Code dinâmico e renovação por semestre.
                  </td>
                </tr>
                <tr className="bg-slate-900/30 print:bg-slate-50">
                  <td className="p-3.5 border-r border-slate-800/60 text-slate-400 print:border-slate-200 print:text-slate-600">
                    Embarque sem conferência rigorosa, permitindo passageiros não autorizados ou caronas clandestinas.
                  </td>
                  <td className="p-3.5 font-medium text-slate-200 print:text-slate-900">
                    Leitura obrigatória via aplicativo PWA na porta do ônibus, bloqueando 100% dos não cadastrados.
                  </td>
                </tr>
                <tr>
                  <td className="p-3.5 border-r border-slate-800/60 text-slate-400 print:border-slate-200 print:text-slate-600">
                    Aglomerações e incerteza dos alunos sobre horários de saída e capacidade de lotação.
                  </td>
                  <td className="p-3.5 font-medium text-slate-200 print:text-slate-900">
                    Reserva prévia de assentos e acompanhamento do status da chamada em tempo real.
                  </td>
                </tr>
                <tr className="bg-slate-900/30 print:bg-slate-50">
                  <td className="p-3.5 border-r border-slate-800/60 text-slate-400 print:border-slate-200 print:text-slate-600">
                    Falta de controle de itinerários, pontos de parada e horas rodadas pela frota.
                  </td>
                  <td className="p-3.5 font-medium text-slate-200 print:text-slate-900">
                    Mapeamento inteligente de rotas com Geofencing GPS e histórico de motoristas.
                  </td>
                </tr>
                <tr>
                  <td className="p-3.5 border-r border-slate-800/60 text-slate-400 print:border-slate-200 print:text-slate-600">
                    Risco de ressalvas ou glosas em fiscalizações do Tribunal de Contas (TCE/TCM).
                  </td>
                  <td className="p-3.5 font-medium text-slate-200 print:text-slate-900">
                    Trilha imutável de auditoria e geração automática de relatórios de prestação de contas.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ARQUITETURA DE MÓDULOS DO SISTEMA */}
        <section className="mb-10">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 print:text-slate-900">
              <Layers className="h-5 w-5 text-blue-400" />
              Módulos Integrados do Sistema
            </h2>
            <p className="text-xs text-slate-400 print:text-slate-600">
              Engenharia modular concebida para atender à Secretaria de Educação, Secretaria de Transportes e Fiscais de Campo.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* MÓDULO 1 */}
            <div className="rounded-xl border border-slate-800 bg-[#0F172A]/80 p-5 print:border-slate-300 print:bg-slate-50">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-950 border border-blue-800/50 text-blue-400 print:bg-slate-200 print:text-slate-800">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <h3 className="font-semibold text-sm text-white print:text-slate-900">Carteirinha & Identidade Digital</h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed print:text-slate-700">
                Emissão de credenciais com foto do estudante, dados do curso/escola, período de vigência e código QR único para validação no transporte.
              </p>
            </div>

            {/* MÓDULO 2 */}
            <div className="rounded-xl border border-slate-800 bg-[#0F172A]/80 p-5 print:border-slate-300 print:bg-slate-50">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-950 border border-blue-800/50 text-blue-400 print:bg-slate-200 print:text-slate-800">
                  <Zap className="h-4 w-4" />
                </div>
                <h3 className="font-semibold text-sm text-white print:text-slate-900">App de Embarque PWA (Offline)</h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed print:text-slate-700">
                Aplicativo para o monitor ou motorista escanear o QR Code da carteirinha na porta do ônibus. Funciona normalmente em locais sem sinal de internet 4G.
              </p>
            </div>

            {/* MÓDULO 3 */}
            <div className="rounded-xl border border-slate-800 bg-[#0F172A]/80 p-5 print:border-slate-300 print:bg-slate-50">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-950 border border-blue-800/50 text-blue-400 print:bg-slate-200 print:text-slate-800">
                  <Calendar className="h-4 w-4" />
                </div>
                <h3 className="font-semibold text-sm text-white print:text-slate-900">Reserva de Assentos & Fila</h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed print:text-slate-700">
                Os alunos confirmam presença previamente, eliminando a disputa por lugares e garantindo que a prefeitura dimensione a frota com exatidão.
              </p>
            </div>

            {/* MÓDULO 4 */}
            <div className="rounded-xl border border-slate-800 bg-[#0F172A]/80 p-5 print:border-slate-300 print:bg-slate-50">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-950 border border-blue-800/50 text-blue-400 print:bg-slate-200 print:text-slate-800">
                  <Compass className="h-4 w-4" />
                </div>
                <h3 className="font-semibold text-sm text-white print:text-slate-900">Rotas & Geofencing GPS</h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed print:text-slate-700">
                Mapeamento de itinerários e pontos de embarque com validação por raio de presença via GPS, registrando com precisão a passagem do transporte.
              </p>
            </div>

            {/* MÓDULO 5 */}
            <div className="rounded-xl border border-slate-800 bg-[#0F172A]/80 p-5 print:border-slate-300 print:bg-slate-50">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-950 border border-blue-800/50 text-blue-400 print:bg-slate-200 print:text-slate-800">
                  <Building2 className="h-4 w-4" />
                </div>
                <h3 className="font-semibold text-sm text-white print:text-slate-900">Gestão de Frota & Motoristas</h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed print:text-slate-700">
                Cadastro centralizado de veículos (próprios ou terceirizados), vistorias periódicas, documentação, capacidade de passageiros e escala de motoristas.
              </p>
            </div>

            {/* MÓDULO 6 */}
            <div className="rounded-xl border border-slate-800 bg-[#0F172A]/80 p-5 print:border-slate-300 print:bg-slate-50">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-950 border border-blue-800/50 text-blue-400 print:bg-slate-200 print:text-slate-800">
                  <Lock className="h-4 w-4" />
                </div>
                <h3 className="font-semibold text-sm text-white print:text-slate-900">Painel de Auditoria & TCE</h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed print:text-slate-700">
                Registro de logs para auditoria de órgãos de controle público, exportação de relatórios em PDF/Excel e conformidade total com a LGPD.
              </p>
            </div>
          </div>
        </section>

        {/* GOVERNANÇA, SEGURANÇA E LGPD */}
        <section className="mb-10">
          <div className="rounded-xl border border-slate-800 bg-[#0F172A]/70 p-6 print:border-slate-300 print:bg-white">
            <h2 className="text-base font-bold text-white flex items-center gap-2 mb-3 print:text-slate-900">
              <Lock className="h-4 w-4 text-blue-400" />
              Segurança da Informação e Conformidade Técnica
            </h2>
            <div className="grid gap-4 sm:grid-cols-3 text-xs">
              <div className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800 print:border-slate-300 print:bg-slate-50">
                <p className="font-semibold text-slate-200 print:text-slate-900">Isolamento Multi-Tenant (RLS)</p>
                <p className="mt-1 text-slate-400 print:text-slate-700">
                  Cada município possui isolamento absoluto de dados no banco PostgreSQL via Row Level Security. Nenhuma prefeitura acessa dados de outra.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800 print:border-slate-300 print:bg-slate-50">
                <p className="font-semibold text-slate-200 print:text-slate-900">Conformidade com a LGPD</p>
                <p className="mt-1 text-slate-400 print:text-slate-700">
                  Tratamento seguro dos dados pessoais de estudantes e responsáveis, com permissões estritas baseadas no papel do usuário.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800 print:border-slate-300 print:bg-slate-50">
                <p className="font-semibold text-slate-200 print:text-slate-900">Infraestrutura em Nuvem</p>
                <p className="mt-1 text-slate-400 print:text-slate-700">
                  Hospedagem de alta disponibilidade com backups diários automáticos, criptografia SSL/TLS e tempo de resposta de milissegundos.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ESTIMATIVA DE IMPACTO FINANCEIRO E EFICIÊNCIA */}
        <section className="mb-10">
          <div className="rounded-xl border border-slate-800 bg-[#0F172A]/70 p-6 sm:p-8 print:border-slate-300 print:bg-white">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-5 gap-4 print:border-slate-300">
              <div>
                <h2 className="text-lg font-bold text-white print:text-slate-900">Estimativa de Impacto no Município</h2>
                <p className="text-xs text-slate-400 print:text-slate-600">Simulação de eficiência operacional e redução de insumos.</p>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs text-slate-300 font-medium print:text-slate-800">Alunos Atendidos:</label>
                <select
                  value={qtdAlunos}
                  onChange={(e) => setQtdAlunos(Number(e.target.value))}
                  className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500 print:bg-slate-100 print:text-slate-900 print:border-slate-300"
                >
                  <option value={500}>500 alunos</option>
                  <option value={1000}>1.000 alunos</option>
                  <option value={1500}>1.500 alunos</option>
                  <option value={3000}>3.000 alunos</option>
                  <option value={5000}>5.000 alunos</option>
                  <option value={10000}>10.000 alunos</option>
                </select>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800 text-left print:border-slate-300 print:bg-slate-50">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide print:text-slate-600">Economia Est. Papel / Insumos</p>
                <p className="mt-2 text-2xl font-bold text-emerald-400 print:text-emerald-700">{economiaEstimada}</p>
                <p className="mt-1 text-[11px] text-slate-500">Estimativa anual com eliminação do papel</p>
              </div>

              <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800 text-left print:border-slate-300 print:bg-slate-50">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide print:text-slate-600">Horas de Servidores Poupadas</p>
                <p className="mt-2 text-2xl font-bold text-blue-400 print:text-blue-700">{horasServidores} horas / ano</p>
                <p className="mt-1 text-[11px] text-slate-500">Horas retrabalhadas convertidas em atendimento</p>
              </div>

              <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800 text-left print:border-slate-300 print:bg-slate-50">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide print:text-slate-600">Vagas Irregulares Recuperadas</p>
                <p className="mt-2 text-2xl font-bold text-cyan-400 print:text-cyan-700">~{vagasRecuperadas} vagas</p>
                <p className="mt-1 text-[11px] text-slate-500">Assentos garantidos aos alunos de direito</p>
              </div>
            </div>
          </div>
        </section>

        {/* PLANO DE IMPLANTAÇÃO EM 4 FASES */}
        <section className="mb-12">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-white print:text-slate-900">Cronograma de Implantação (4 Semanas)</h2>
            <p className="text-xs text-slate-400 print:text-slate-600">Processo estruturado de adoção com suporte técnico da equipe VannTec.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-4 text-xs">
            <div className="p-4 rounded-lg border border-slate-800 bg-[#0F172A]/60 print:border-slate-300 print:bg-slate-50">
              <span className="font-bold text-blue-400 print:text-blue-700">Fase 1 · Semana 1</span>
              <p className="mt-1 font-semibold text-slate-200 print:text-slate-900">Configuração Inicial</p>
              <p className="mt-1 text-slate-400 print:text-slate-700">Setup da secretaria, cadastro da frota, motoristas e mapeamento das rotas.</p>
            </div>

            <div className="p-4 rounded-lg border border-slate-800 bg-[#0F172A]/60 print:border-slate-300 print:bg-slate-50">
              <span className="font-bold text-blue-400 print:text-blue-700">Fase 2 · Semana 2</span>
              <p className="mt-1 font-semibold text-slate-200 print:text-slate-900">Capacitação da Equipe</p>
              <p className="mt-1 text-slate-400 print:text-slate-700">Treinamento dos fiscais, motoristas e servidores administrativos.</p>
            </div>

            <div className="p-4 rounded-lg border border-slate-800 bg-[#0F172A]/60 print:border-slate-300 print:bg-slate-50">
              <span className="font-bold text-blue-400 print:text-blue-700">Fase 3 · Semana 3</span>
              <p className="mt-1 font-semibold text-slate-200 print:text-slate-900">Adesão dos Alunos</p>
              <p className="mt-1 text-slate-400 print:text-slate-700">Autocadastro de estudantes e emissão em lote das carteirinhas digitais.</p>
            </div>

            <div className="p-4 rounded-lg border border-slate-800 bg-[#0F172A]/60 print:border-slate-300 print:bg-slate-50">
              <span className="font-bold text-blue-400 print:text-blue-700">Fase 4 · Semana 4</span>
              <p className="mt-1 font-semibold text-slate-200 print:text-slate-900">Operação 100% Digital</p>
              <p className="mt-1 text-slate-400 print:text-slate-700">Validação via QR Code nos ônibus e monitoramento de métricas ao vivo.</p>
            </div>
          </div>
        </section>

        {/* ENCERRAMENTO E CONTATO COMERCIAL */}
        <section id="solicitar" className="rounded-xl border border-slate-800 bg-[#0F172A] p-6 sm:p-10 text-center print:border-slate-300 print:bg-slate-50">
          <h2 className="text-xl font-bold text-white sm:text-2xl print:text-slate-900">
            Agende uma Apresentação Técnica ou Projeto Piloto
          </h2>
          <p className="mt-2 text-xs text-slate-400 max-w-xl mx-auto print:text-slate-700">
            A equipe técnica da VannTec está à disposição para realizar uma demonstração presencial ou remota com a equipe da sua prefeitura.
          </p>

          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3 print:hidden">
            <a
              href="https://wa.me/5587999999999?text=Olá,%20gostaria%20de%20agendar%20uma%20demonstração%20técnica%20do%20SYSBUS%20para%20minha%20prefeitura."
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-6 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-blue-500"
            >
              <Phone className="h-4 w-4" />
              Solicitar Reunião via WhatsApp
            </a>
            <button
              onClick={imprimir}
              className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-5 py-2.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
            >
              <Printer className="h-4 w-4" />
              Gerar PDF da Proposta
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-800/80 grid gap-4 sm:grid-cols-2 text-left text-xs text-slate-400 print:border-slate-300 print:text-slate-800">
            <div>
              <p className="font-semibold text-slate-200 print:text-slate-900">VannTec · Tecnologia para a Administração Pública</p>
              <p className="mt-0.5 text-slate-400">Desenvolvimento de Sistemas de Alta Confiabilidade para Governo.</p>
            </div>
            <div className="sm:text-right">
              <p className="font-semibold text-slate-200 print:text-slate-900">Contato Executivo</p>
              <p className="mt-0.5 text-slate-400">E-mail: contato@vanntec.com.br · SYSBUS 2.0</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
