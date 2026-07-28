import { useState } from "react";
import {
  Bus,
  ShieldCheck,
  QrCode,
  MapPin,
  CheckCircle2,
  Building2,
  Smartphone,
  GraduationCap,
  Sparkles,
  Printer,
  Share2,
  Phone,
  Mail,
  Award,
  CalendarCheck,
  AlertTriangle,
  Zap,
} from "lucide-react";

export default function PropostaComercial() {
  const [qtdAlunos, setQtdAlunos] = useState<number>(1500);
  const [abaSec, setAbaSec] = useState<"educacao" | "transporte" | "prefeito">("educacao");
  const [copiado, setCopiado] = useState(false);

  // Cálculos dinâmicos da calculadora de impacto
  const economiaImpressao = (qtdAlunos * 18.5).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
  const horasEconomizadas = Math.round(qtdAlunos * 0.45);
  const reducaoIrregulares = Math.round(qtdAlunos * 0.18);

  function compartilharLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  }

  function imprimir() {
    window.print();
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-brand-500 selection:text-white print:bg-white print:text-slate-900">
      {/* BARRA SUPERIOR FIXA DE AÇÕES (Oculta na impressão) */}
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md print:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <img
              src="/sysbus-logo.png"
              alt="SYSBUS Logo"
              className="h-9 w-auto object-contain rounded-xl ring-1 ring-white/10"
            />
            <div>
              <p className="text-xs font-bold tracking-wider text-slate-200 uppercase">SYSBUS 2.0</p>
              <p className="text-[10px] text-slate-400">Proposta Comercial & Institucional</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={compartilharLink}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
            >
              <Share2 className="h-3.5 w-3.5" />
              {copiado ? "Link Copiado!" : "Compartilhar Link"}
            </button>
            <button
              onClick={imprimir}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
            >
              <Printer className="h-3.5 w-3.5" />
              Imprimir / PDF
            </button>
            <a
              href="#contato"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white transition-all hover:bg-brand-500 shadow-lg shadow-brand-600/20"
            >
              Solicitar Piloto
            </a>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative overflow-hidden pt-12 pb-20 sm:pt-16 sm:pb-28">
        {/* Glow Effects */}
        <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-brand-600/15 blur-[120px] print:hidden" />
        <div className="pointer-events-none absolute top-1/3 -right-40 h-[400px] w-[500px] rounded-full bg-cyan-500/10 blur-[100px] print:hidden" />

        <div className="relative mx-auto max-w-5xl px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-3.5 py-1.5 text-xs font-semibold text-brand-300 backdrop-blur-sm mb-6 print:border-slate-300 print:bg-slate-100 print:text-slate-800">
            <Sparkles className="h-3.5 w-3.5 text-brand-400 print:hidden" />
            <span>SOLUÇÃO GOVTECH · VANNTEC TECNOLOGIA</span>
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl leading-[1.15] print:text-slate-900">
            A Transformação Digital do <br />
            <span className="bg-gradient-to-r from-brand-400 via-cyan-300 to-blue-500 bg-clip-text text-transparent print:text-brand-700">
              Transporte Escolar & Universitário
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base text-slate-300 sm:text-lg leading-relaxed print:text-slate-700">
            Uma plataforma de alta performance construída para eliminar o caos manual, zerar fraudes de embarque e oferecer total governança para Prefeituras e Secretarias Municipais.
          </p>

          {/* Key Metrics Badges */}
          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4 max-w-3xl mx-auto">
            <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3.5 text-left backdrop-blur-sm print:border-slate-200 print:bg-slate-50">
              <p className="text-2xl font-bold text-brand-400 print:text-brand-700">100%</p>
              <p className="text-xs text-slate-400 print:text-slate-600">Digital & Sem Papel</p>
            </div>
            <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3.5 text-left backdrop-blur-sm print:border-slate-200 print:bg-slate-50">
              <p className="text-2xl font-bold text-cyan-400 print:text-cyan-700">0%</p>
              <p className="text-xs text-slate-400 print:text-slate-600">Embarques Irregulares</p>
            </div>
            <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3.5 text-left backdrop-blur-sm print:border-slate-200 print:bg-slate-50">
              <p className="text-2xl font-bold text-emerald-400 print:text-emerald-700">Realtime</p>
              <p className="text-xs text-slate-400 print:text-slate-600">Chamada & Fila ao Vivo</p>
            </div>
            <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3.5 text-left backdrop-blur-sm print:border-slate-200 print:bg-slate-50">
              <p className="text-2xl font-bold text-amber-400 print:text-amber-700">Auditável</p>
              <p className="text-xs text-slate-400 print:text-slate-600">Compliance TCE / TCM</p>
            </div>
          </div>
        </div>
      </section>

      {/* SEÇÃO DA HISTÓRIA (Coração do Diferencial SYSBUS) */}
      <section className="py-16 bg-slate-900/60 border-y border-slate-800/60 relative print:bg-white print:border-slate-300">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-5">
              <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-400 mb-3 print:text-brand-700">
                <GraduationCap className="h-4 w-4" />
                <span>Origem & Filosofia</span>
              </div>
              <h2 className="text-2xl font-bold text-white sm:text-3xl leading-snug print:text-slate-900">
                Projetado por quem viveu a realidade do estudante
              </h2>
              <p className="mt-4 text-sm text-slate-300 leading-relaxed print:text-slate-700">
                Muitos sistemas corporativos falham porque foram criados por desenvolvedores trancados em salas de reunião, longe do ponto de ônibus.
              </p>
              <p className="mt-3 text-sm text-slate-300 leading-relaxed print:text-slate-700">
                O **SYSBUS 2.0** nasceu de uma experiência real e prática: o dia a dia de um estudante universitário enfrentando o transporte público municipal.
              </p>

              <div className="mt-6 flex items-center gap-3 rounded-xl bg-slate-800/80 p-3.5 border border-slate-700/60 print:bg-slate-100 print:border-slate-300">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-600/20 text-brand-400 print:bg-brand-100 print:text-brand-700">
                  <Award className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white print:text-slate-900">Engenharia orientada à dor real</p>
                  <p className="text-[11px] text-slate-400 print:text-slate-600">Cada botão e regra do sistema foi testado para facilitar a vida da prefeitura e do aluno.</p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 backdrop-blur-sm relative overflow-hidden print:border-slate-300 print:bg-slate-50">
                  <div className="flex items-start gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-400 font-bold text-sm border border-red-500/20 print:bg-red-100 print:text-red-700">
                      1
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-white print:text-slate-900">A Dor da Fila e da Incerteza</h3>
                      <p className="mt-1 text-xs text-slate-300 leading-relaxed print:text-slate-700">
                        Longas filas de espera, tumulto na porta do ônibus, falta de confirmação de assento e grupos de WhatsApp desorganizados onde avisos importantes se perdiam.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 backdrop-blur-sm relative overflow-hidden print:border-slate-300 print:bg-slate-50">
                  <div className="flex items-start gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-400 font-bold text-sm border border-amber-500/20 print:bg-amber-100 print:text-amber-700">
                      2
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-white print:text-slate-900">A Burocracia da Secretaria</h3>
                      <p className="mt-1 text-xs text-slate-300 leading-relaxed print:text-slate-700">
                        Servidores públicos sobrecarregados conferindo papéis um a um, imprimindo carteirinhas de papel que rasgavam no primeiro mês e sem saber se havia vaga suficiente na frota.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-brand-500/40 bg-brand-950/20 p-5 backdrop-blur-sm relative overflow-hidden print:border-brand-300 print:bg-brand-50">
                  <div className="flex items-start gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 font-bold text-sm border border-emerald-500/20 print:bg-emerald-100 print:text-emerald-700">
                      3
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-emerald-400 print:text-emerald-800">A Resposta Inteligente: SYSBUS</h3>
                      <p className="mt-1 text-xs text-slate-300 leading-relaxed print:text-slate-700">
                        Um ecossistema automatizado onde o aluno renova sua carteirinha pelo celular, reserva seu assento em segundos e o fiscal valida a entrada com QR Code na porta do ônibus.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* RECURSOS & FUNCIONALIDADES CHAVE */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center max-w-3xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 print:text-cyan-700">
              Arquitetura de Solução
            </span>
            <h2 className="mt-2 text-2xl font-bold text-white sm:text-4xl print:text-slate-900">
              Os 6 Pilares de Automação do SYSBUS 2.0
            </h2>
            <p className="mt-3 text-sm text-slate-400 print:text-slate-600">
              Tudo o que a prefeitura precisa para gerir com perfeição o transporte escolar e universitário.
            </p>
          </div>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* CARD 1 */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-sm transition-all hover:border-brand-500/50 hover:bg-slate-900 print:border-slate-200 print:bg-slate-50">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/10 text-brand-400 border border-brand-500/20 mb-5 print:bg-brand-100 print:text-brand-700">
                <QrCode className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-white print:text-slate-900">Carteirinha Digital & QR Code</h3>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed print:text-slate-600">
                Fim do gasto recorrente com carteirinhas de papel. O aluno possui sua credencial oficial com foto e QR Code dinâmico antifraude no próprio smartphone.
              </p>
            </div>

            {/* CARD 2 */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-sm transition-all hover:border-cyan-500/50 hover:bg-slate-900 print:border-slate-200 print:bg-slate-50">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 mb-5 print:bg-cyan-100 print:text-cyan-700">
                <CalendarCheck className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-white print:text-slate-900">Reserva de Vagas & Fila ao Vivo</h3>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed print:text-slate-600">
                Elimina aglomerações e incertezas. Os alunos confirmam presença nas viagens de forma antecipada e acompanham a chamada em tempo real.
              </p>
            </div>

            {/* CARD 3 */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-sm transition-all hover:border-emerald-500/50 hover:bg-slate-900 print:border-slate-200 print:bg-slate-50">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-5 print:bg-emerald-100 print:text-emerald-700">
                <Smartphone className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-white print:text-slate-900">App de Embarque PWA (Offline)</h3>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed print:text-slate-600">
                Fiscais e motoristas leem o QR Code da carteirinha direto no celular na porta do veículo. Funciona perfeitamente mesmo em zonas rurais sem sinal de 4G.
              </p>
            </div>

            {/* CARD 4 */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-sm transition-all hover:border-amber-500/50 hover:bg-slate-900 print:border-slate-200 print:bg-slate-50">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 mb-5 print:bg-amber-100 print:text-amber-700">
                <MapPin className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-white print:text-slate-900">Rotas & Geofencing GPS</h3>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed print:text-slate-600">
                Cadastro inteligente de itinerários e pontos de embarque com validação por raio geográfico GPS, garantindo presença real na rota.
              </p>
            </div>

            {/* CARD 5 */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-sm transition-all hover:border-purple-500/50 hover:bg-slate-900 print:border-slate-200 print:bg-slate-50">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 mb-5 print:bg-purple-100 print:text-purple-700">
                <Bus className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-white print:text-slate-900">Gestão de Frota & Motoristas</h3>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed print:text-slate-600">
                Controle completo de veículos municipais e terceirizados, vistorias, motoristas, capacidade permitida e alocação de frota.
              </p>
            </div>

            {/* CARD 6 */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-sm transition-all hover:border-rose-500/50 hover:bg-slate-900 print:border-slate-200 print:bg-slate-50">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 mb-5 print:bg-rose-100 print:text-rose-700">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-white print:text-slate-900">Auditoria para TCE & Controladoria</h3>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed print:text-slate-600">
                Relatórios consolidados e logs imutáveis de embarque para prestação de contas com total transparência perante órgãos de fiscalização pública.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ANTES VS DEPOIS (TABELA COMPARATIVA) */}
      <section className="py-16 bg-slate-900/40 border-y border-slate-800/60 print:bg-white print:border-slate-300">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl font-bold text-white sm:text-3xl print:text-slate-900">
              Gestão Tradicional vs. Era SYSBUS 2.0
            </h2>
            <p className="mt-2 text-xs text-slate-400 print:text-slate-600">
              Veja a diferença imediata na operação do seu município.
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/80 shadow-2xl print:border-slate-300 print:bg-white">
            <div className="grid grid-cols-2 bg-slate-900/90 p-4 border-b border-slate-800 font-bold text-sm print:bg-slate-100 print:text-slate-900">
              <div className="text-red-400 flex items-center gap-2 print:text-red-700">
                <AlertTriangle className="h-4 w-4" />
                <span>Como é hoje (Processo Manual)</span>
              </div>
              <div className="text-emerald-400 flex items-center gap-2 print:text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                <span>Com o SYSBUS 2.0</span>
              </div>
            </div>

            <div className="divide-y divide-slate-800/60 text-xs print:divide-slate-200">
              <div className="grid grid-cols-2 p-4 gap-4">
                <p className="text-slate-400 print:text-slate-700">Carteirinhas impressas em papel ou plástico que rasgam ou desbotam.</p>
                <p className="text-slate-200 font-medium print:text-slate-900">Carteirinha Digital no celular com QR Code dinâmico e renovação automática.</p>
              </div>
              <div className="grid grid-cols-2 p-4 gap-4 bg-slate-900/30 print:bg-slate-50">
                <p className="text-slate-400 print:text-slate-700">Passageiros sem autorização embarcando sem controle nos ônibus.</p>
                <p className="text-slate-200 font-medium print:text-slate-900">Leitura obrigatória de QR Code na porta, bloqueando 100% dos não cadastrados.</p>
              </div>
              <div className="grid grid-cols-2 p-4 gap-4">
                <p className="text-slate-400 print:text-slate-700">Alunos sem saber se haverá ônibus ou lugar disponível no retorno.</p>
                <p className="text-slate-200 font-medium print:text-slate-900">Reserva de assentos e painel de fila ao vivo pelo smartphone.</p>
              </div>
              <div className="grid grid-cols-2 p-4 gap-4 bg-slate-900/30 print:bg-slate-50">
                <p className="text-slate-400 print:text-slate-700">Servidores gastando meses conferindo documentos fisicamente na secretaria.</p>
                <p className="text-slate-200 font-medium print:text-slate-900">Workflow de aprovação em poucos cliques com auditoria completa.</p>
              </div>
              <div className="grid grid-cols-2 p-4 gap-4">
                <p className="text-slate-400 print:text-slate-700">Risco de apontamentos e glosas em fiscalizações do Tribunal de Contas (TCE).</p>
                <p className="text-slate-200 font-medium print:text-slate-900">Relatórios em tempo real comprovando cada viagem e presença de alunos.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BENEFÍCIOS POR SECRETARIA (ABAS INTERATIVAS) */}
      <section className="py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="text-center mb-8">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-400 print:text-brand-700">
              Valor para a Gestão Pública
            </span>
            <h2 className="mt-1 text-2xl font-bold text-white sm:text-3xl print:text-slate-900">
              O que o SYSBUS entrega para cada gestor
            </h2>
          </div>

          {/* Abas */}
          <div className="flex justify-center gap-2 mb-8 print:hidden">
            <button
              onClick={() => setAbaSec("educacao")}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                abaSec === "educacao"
                  ? "bg-brand-600 text-white shadow-lg shadow-brand-600/30"
                  : "bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              Secretaria de Educação
            </button>
            <button
              onClick={() => setAbaSec("transporte")}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                abaSec === "transporte"
                  ? "bg-brand-600 text-white shadow-lg shadow-brand-600/30"
                  : "bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              Secretaria de Transportes
            </button>
            <button
              onClick={() => setAbaSec("prefeito")}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                abaSec === "prefeito"
                  ? "bg-brand-600 text-white shadow-lg shadow-brand-600/30"
                  : "bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              Prefeito & Controladoria
            </button>
          </div>

          {/* Conteúdo da Aba */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-sm print:border-slate-200 print:bg-slate-50">
            {abaSec === "educacao" && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500/10 text-brand-400 print:bg-brand-100 print:text-brand-700">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base print:text-slate-900">Foco na Aprendizagem e Atendimento ao Aluno</h3>
                    <p className="text-xs text-slate-400 print:text-slate-600">Simplifique a vida dos alunos e servidores municipais.</p>
                  </div>
                </div>
                <ul className="space-y-2.5 text-xs text-slate-300 print:text-slate-700 pt-2">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-brand-400 shrink-0 mt-0.5 print:text-brand-700" />
                    <span>Elimina as filas quilométricas de renovação de carteirinhas na Secretaria de Educação no início do ano.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-brand-400 shrink-0 mt-0.5 print:text-brand-700" />
                    <span>Validação de vínculo escolar automatizada via upload de comprovantes no app.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-brand-400 shrink-0 mt-0.5 print:text-brand-700" />
                    <span>Garantia de que 100% dos alunos matriculados e autorizados tenham acesso garantido ao transporte.</span>
                  </li>
                </ul>
              </div>
            )}

            {abaSec === "transporte" && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400 print:bg-cyan-100 print:text-cyan-700">
                    <Bus className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base print:text-slate-900">Controle Operacional Eficiente da Frota</h3>
                    <p className="text-xs text-slate-400 print:text-slate-600">Previsibilidade total para rotas e motoristas.</p>
                  </div>
                </div>
                <ul className="space-y-2.5 text-xs text-slate-300 print:text-slate-700 pt-2">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5 print:text-cyan-700" />
                    <span>Mapeamento exato da demanda diária por rota, permitindo dimensionar ônibus sem sobra nem falta de vagas.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5 print:text-cyan-700" />
                    <span>Bloqueio de passageiros clandestinos e caronas não autorizadas nos veículos públicos.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5 print:text-cyan-700" />
                    <span>Monitoramento de pontos de embarque via GPS e historização completa de horários e motoristas.</span>
                  </li>
                </ul>
              </div>
            )}

            {abaSec === "prefeito" && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 print:bg-emerald-100 print:text-emerald-700">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base print:text-slate-900">Governança, Legado & Cidade Inteligente</h3>
                    <p className="text-xs text-slate-400 print:text-slate-600">Aprovação popular e responsabilidade fiscal.</p>
                  </div>
                </div>
                <ul className="space-y-2.5 text-xs text-slate-300 print:text-slate-700 pt-2">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5 print:text-emerald-700" />
                    <span>Marca registrada de inovação e modernização da gestão pública municipal (Smart City).</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5 print:text-emerald-700" />
                    <span>Blindagem jurídica e contábil contra apontamentos do Tribunal de Contas (TCE/TCM).</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5 print:text-emerald-700" />
                    <span>Alta aprovação das famílias e jovens pela facilidade da carteirinha digital no celular.</span>
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* CALCULADORA DE IMPACTO E ECONOMIA MUNICIPAL */}
      <section className="py-16 bg-slate-900/60 border-y border-slate-800/60 print:bg-white print:border-slate-300">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 print:text-emerald-700">
              Simulador de Economia
            </span>
            <h2 className="mt-1 text-2xl font-bold text-white sm:text-3xl print:text-slate-900">
              Estimativa de Impacto no seu Município
            </h2>
            <p className="mt-2 text-xs text-slate-400 print:text-slate-600">
              Arraste a barra abaixo para selecionar a quantidade aproximada de estudantes atendidos pelo transporte municipal.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 sm:p-8 backdrop-blur-sm print:border-slate-300 print:bg-slate-50">
            {/* Slider Input */}
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm font-semibold">
                <span className="text-slate-300 print:text-slate-700">Quantidade de Alunos Atendidos:</span>
                <span className="text-xl font-extrabold text-brand-400 print:text-brand-700">{qtdAlunos.toLocaleString("pt-BR")} alunos</span>
              </div>
              <input
                type="range"
                min="200"
                max="10000"
                step="100"
                value={qtdAlunos}
                onChange={(e) => setQtdAlunos(Number(e.target.value))}
                className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>200 alunos</span>
                <span>5.000 alunos</span>
                <span>10.000 alunos</span>
              </div>
            </div>

            {/* Dynamic Results Grid */}
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 text-center print:border-emerald-300 print:bg-emerald-50">
                <p className="text-xs text-emerald-300 font-medium print:text-emerald-800">Economia Est. em Papel & PVC</p>
                <p className="mt-1 text-2xl font-extrabold text-emerald-400 print:text-emerald-700">{economiaImpressao}</p>
                <p className="mt-1 text-[10px] text-slate-400 print:text-slate-600">Redução direta de insumos anuais</p>
              </div>

              <div className="rounded-xl border border-brand-500/30 bg-brand-950/20 p-4 text-center print:border-brand-300 print:bg-brand-50">
                <p className="text-xs text-brand-300 font-medium print:text-brand-800">Horas Salvas de Servidores</p>
                <p className="mt-1 text-2xl font-extrabold text-brand-400 print:text-brand-700">{horasEconomizadas}h / ano</p>
                <p className="mt-1 text-[10px] text-slate-400 print:text-slate-600">Redirecionadas para atendimento</p>
              </div>

              <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-4 text-center print:border-cyan-300 print:bg-cyan-50">
                <p className="text-xs text-cyan-300 font-medium print:text-cyan-800">Passagens Irregulares Bloqueadas</p>
                <p className="mt-1 text-2xl font-extrabold text-cyan-400 print:text-cyan-700">~{reducaoIrregulares} vagas</p>
                <p className="mt-1 text-[10px] text-slate-400 print:text-slate-600">Liberadas para alunos de direito</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PLANO DE IMPLANTAÇÃO (CRONOGRAMA RÁPIDO) */}
      <section className="py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-400 print:text-brand-700">
              Implantação Descomplicada
            </span>
            <h2 className="mt-1 text-2xl font-bold text-white sm:text-3xl print:text-slate-900">
              Operação 100% Ativa em 4 Semanas
            </h2>
            <p className="mt-2 text-xs text-slate-400 print:text-slate-600">
              A equipe da VannTec cuida do suporte técnico e do treinamento completo da sua equipe.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 relative print:border-slate-200 print:bg-slate-50">
              <span className="text-xs font-bold text-brand-400 print:text-brand-700">Semana 1</span>
              <h3 className="mt-1 font-semibold text-sm text-white print:text-slate-900">Configuração & Rotas</h3>
              <p className="mt-1 text-[11px] text-slate-400 print:text-slate-600">Cadastro do município, cadastro de veículos, motoristas e itinerários.</p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 relative print:border-slate-200 print:bg-slate-50">
              <span className="text-xs font-bold text-cyan-400 print:text-cyan-700">Semana 2</span>
              <h3 className="mt-1 font-semibold text-sm text-white print:text-slate-900">Treinamento da Equipe</h3>
              <p className="mt-1 text-[11px] text-slate-400 print:text-slate-600">Treinamento simples para fiscais, motoristas e servidores da secretaria.</p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 relative print:border-slate-200 print:bg-slate-50">
              <span className="text-xs font-bold text-emerald-400 print:text-emerald-700">Semana 3</span>
              <h3 className="mt-1 font-semibold text-sm text-white print:text-slate-900">Carteirinha aos Alunos</h3>
              <p className="mt-1 text-[11px] text-slate-400 print:text-slate-600">Abertura de autocadastro para estudantes e geração de credenciais digitais.</p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 relative print:border-slate-200 print:bg-slate-50">
              <span className="text-xs font-bold text-amber-400 print:text-amber-700">Semana 4</span>
              <h3 className="mt-1 font-semibold text-sm text-white print:text-slate-900">Operação 100% Digital</h3>
              <p className="mt-1 text-[11px] text-slate-400 print:text-slate-600">Início da leitura de QR Code no embarque e relatórios ao vivo.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA FINAL E PROJETO PILOTO */}
      <section id="contato" className="py-20 relative overflow-hidden bg-gradient-to-b from-slate-900 to-slate-950 border-t border-slate-800 print:bg-white print:border-slate-300">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-bold text-emerald-400 mb-6 print:border-slate-300 print:bg-slate-100 print:text-slate-900">
            <Zap className="h-4 w-4" />
            <span>OFERTA ESPECIAL PARA MUNICÍPIOS</span>
          </div>

          <h2 className="text-3xl font-extrabold text-white sm:text-4xl print:text-slate-900">
            Leve o SYSBUS 2.0 para a sua Prefeitura sem Risco
          </h2>

          <p className="mt-4 text-sm text-slate-300 max-w-xl mx-auto leading-relaxed print:text-slate-700">
            Oferecemos uma **Apresentação Técnica Presencial ou Remota** e a oportunidade de um **Projeto Piloto Gratuito por 30 Dias** na rota principal do seu município.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 print:hidden">
            <a
              href="https://wa.me/5587999999999?text=Olá!%20Gostaria%20de%20agendar%20uma%20demonstração%20do%20SYSBUS%20para%20minha%20prefeitura."
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 rounded-xl bg-emerald-600 px-8 py-3.5 text-sm font-bold text-white transition-all hover:bg-emerald-500 shadow-xl shadow-emerald-600/25"
            >
              <Phone className="h-4 w-4" />
              <span>Agendar Demonstração via WhatsApp</span>
            </a>
            <button
              onClick={imprimir}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-6 py-3.5 text-sm font-semibold text-slate-200 transition-all hover:bg-slate-700"
            >
              <Printer className="h-4 w-4" />
              <span>Salvar Proposta em PDF</span>
            </button>
          </div>

          {/* Rodapé Comercial */}
          <div className="mt-16 pt-8 border-t border-slate-800/80 grid gap-6 sm:grid-cols-3 text-xs text-slate-400 text-left print:border-slate-300 print:text-slate-700">
            <div>
              <p className="font-bold text-white mb-1 print:text-slate-900">VannTec Tecnologia</p>
              <p className="text-[11px]">Sistemas de Gestão para a Administração Pública Municipal.</p>
            </div>
            <div>
              <p className="font-bold text-white mb-1 print:text-slate-900">Contato Comercial</p>
              <p className="text-[11px] flex items-center gap-1.5"><Mail className="h-3 w-3" /> contato@vanntec.com.br</p>
              <p className="text-[11px] flex items-center gap-1.5 mt-0.5"><Phone className="h-3 w-3" /> Comercial VannTec</p>
            </div>
            <div>
              <p className="font-bold text-white mb-1 print:text-slate-900">Conformidade & Segurança</p>
              <p className="text-[11px]">100% adequado à LGPD, RLS no banco de dados e criptografia SSL/TLS.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
