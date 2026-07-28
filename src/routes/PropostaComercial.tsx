import { useState } from "react";
import {
  QrCode,
  Bus,
  MapPin,
  BarChart3,
  ShieldCheck,
  Users,
  Printer,
  Share2,
  Phone,
  Clock,
  TrendingDown,
  CheckCircle,
  ArrowRight,
  ChevronRight,
} from "lucide-react";

/* ─────────── dados estáticos ─────────── */
const MODULES = [
  {
    Icon: QrCode,
    title: "Carteirinha digital",
    desc: "O estudante tem a credencial no próprio celular, com foto e código de validação. Nenhum papel, nenhuma fila na secretaria.",
  },
  {
    Icon: Bus,
    title: "Embarque com validação",
    desc: "O fiscal escaneia a carteirinha na porta do ônibus. Somente alunos cadastrados entram — e o sistema funciona mesmo sem sinal de internet.",
  },
  {
    Icon: Clock,
    title: "Reserva de assentos",
    desc: "O aluno confirma a viagem com antecedência. A prefeitura dimensiona a frota com dados reais, não com estimativas.",
  },
  {
    Icon: MapPin,
    title: "Rotas e localização",
    desc: "Os itinerários ficam registrados no sistema. A secretaria acompanha cada veículo e valida as paradas por localização.",
  },
  {
    Icon: Users,
    title: "Gestão de frota e motoristas",
    desc: "Cadastro completo de veículos, motoristas, documentação e escala. Tudo em um só painel, sem planilhas.",
  },
  {
    Icon: BarChart3,
    title: "Relatórios e prestação de contas",
    desc: "Dados organizados para auditorias e Tribunais de Contas. Exportação em um clique, sem retrabalho.",
  },
];

const COMPARISONS = [
  {
    before: "Carteirinha de papel que rasga e precisa ser reemitida todo semestre",
    after: "Credencial digital renovada automaticamente, diretamente no celular do aluno",
  },
  {
    before: "Ninguém sabe quantas vagas sobram no ônibus ou se o veículo já passou",
    after: "Reserva prévia de assento e acompanhamento do status da chamada em tempo real",
  },
  {
    before: "Passageiros não autorizados embarcam sem nenhum controle",
    after: "Validação obrigatória na porta: apenas alunos cadastrados e ativos embarcam",
  },
  {
    before: "A prefeitura não tem visibilidade sobre onde está a frota nem quantos quilômetros roda",
    after: "Mapa com localização dos veículos e histórico de rotas disponível a qualquer hora",
  },
  {
    before: "Relatórios manuais tomam dias de trabalho e ainda geram erros",
    after: "Exportação automática de dados prontos para o Tribunal de Contas",
  },
];

const FOR_WHO = [
  {
    label: "Para o estudante",
    points: [
      "Carteirinha sempre disponível no celular",
      "Sabe com antecedência se tem vaga na viagem",
      "Não precisa chegar cedo para garantir lugar",
      "Comunicação direta sobre horários e alterações",
    ],
  },
  {
    label: "Para a Secretaria de Educação",
    points: [
      "Controle atualizado de todos os alunos beneficiários",
      "Renovação de matrículas sem presença física",
      "Histórico de embarques e presença por aluno",
      "Dados organizados para auditorias a qualquer momento",
    ],
  },
  {
    label: "Para a Secretaria de Transportes",
    points: [
      "Visão completa da frota: veículos, motoristas e rotas",
      "Registro de vistorias e documentação dos veículos",
      "Relatórios de desempenho e custos operacionais",
      "Conformidade com as exigências do FNDE e PNATE",
    ],
  },
];

const PHASES = [
  { n: "01", label: "Configuração", desc: "A equipe da VannTec configura o sistema com os dados da prefeitura: frota, rotas e secretaria." },
  { n: "02", label: "Treinamento", desc: "Capacitamos fiscais, motoristas e servidores, de forma presencial ou remota." },
  { n: "03", label: "Cadastro dos alunos", desc: "Os estudantes se cadastram e recebem a carteirinha digital no próprio celular." },
  { n: "04", label: "Operação completa", desc: "O transporte funciona com validação digital e a prefeitura acompanha tudo pelo painel." },
];

/* ─────────── componente ─────────── */
export default function PropostaComercial() {
  const [qtd, setQtd] = useState<number>(1500);
  const [copiado, setCopiado] = useState(false);

  const economiaAnual = (qtd * 16.8).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const horasPoupadas = Math.round(qtd * 0.4);
  const vagasRecuperadas = Math.round(qtd * 0.15);

  function compartilhar() {
    navigator.clipboard.writeText(window.location.href);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans antialiased">

      {/* ── TOP BAR ── */}
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/95 backdrop-blur-sm print:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-3">
            <img src="/sysbus-logo.png" alt="SYSBUS" className="h-7 w-auto rounded-lg" />
            <span className="hidden sm:block text-xs text-slate-400 pl-3 border-l border-slate-200">VannTec &middot; Apresentação Comercial</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={compartilhar} className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 transition-colors">
              <Share2 className="h-3.5 w-3.5" />
              {copiado ? "Copiado!" : "Compartilhar"}
            </button>
            <button onClick={() => window.print()} className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 transition-colors">
              <Printer className="h-3.5 w-3.5" />
              Salvar PDF
            </button>
            <a href="#contato" className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors">
              Agendar reunião <ChevronRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="bg-slate-950 text-white">
        <div className="mx-auto max-w-5xl px-6 pt-24 pb-28 sm:pt-32 sm:pb-36">
          <p className="text-xs font-semibold tracking-widest text-slate-400 uppercase mb-6">
            VannTec &nbsp;·&nbsp; Apresentação para Prefeituras Municipais &nbsp;·&nbsp; 2026
          </p>
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-[1.05] max-w-3xl">
            Transporte escolar<br />
            <span className="text-blue-400">sob controle.</span><br />
            Do celular à secretaria.
          </h1>
          <p className="mt-7 text-base sm:text-lg text-slate-400 max-w-xl leading-relaxed">
            O SYSBUS 2.0 é uma plataforma desenvolvida para municipalidades que querem encerrar definitivamente o ciclo do papel, das filas e da falta de informação no transporte escolar.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <a href="#contato" className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-500 transition-colors">
              Solicitar demonstração <ArrowRight className="h-4 w-4" />
            </a>
            <a href="#funcionamento" className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-6 py-3 text-sm font-medium text-slate-300 hover:bg-slate-900 transition-colors">
              Ver como funciona
            </a>
          </div>
        </div>
      </section>

      {/* ── CONTEXTO / ORIGEM ── */}
      <section className="py-20 bg-white border-b border-slate-100">
        <div className="mx-auto max-w-4xl px-6">
          <div className="grid gap-12 sm:grid-cols-2 items-start">
            <div>
              <p className="text-xs font-semibold text-blue-600 tracking-widest uppercase mb-4">De onde vem este sistema</p>
              <h2 className="text-3xl sm:text-4xl font-black leading-tight">Construído a partir da experiência de quem usou o transporte</h2>
            </div>
            <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
              <p>
                O SYSBUS não foi desenvolvido a partir de uma pesquisa de mercado. Ele nasceu da vivência direta de um estudante que enfrentou as mesmas dificuldades que milhares de alunos enfrentam todos os dias: incerteza sobre horários, carteirinhas que rasgam, grupos de WhatsApp desorganizados e ônibus que chegam sem aviso.
              </p>
              <p>
                Cada funcionalidade do sistema resolve um problema concreto. Não há features adicionadas por modismo tecnológico — há soluções para situações reais, pensadas tanto para quem usa o transporte quanto para quem precisa administrá-lo.
              </p>
            </div>
          </div>

          {/* 3 pilares contextuais */}
          <div className="mt-14 grid gap-px bg-slate-100 rounded-2xl overflow-hidden sm:grid-cols-3">
            {[
              { label: "O problema do aluno", text: "Incerteza sobre vagas, longas esperas na parada e dependência de informações de terceiros para saber se o ônibus veio." },
              { label: "O problema da secretaria", text: "Emissão manual de carteirinhas, planilhas desatualizadas e dificuldade de gerar relatórios confiáveis para auditorias." },
              { label: "O problema da frota", text: "Falta de visibilidade sobre os veículos, motoristas e rotas. Gastos difíceis de justificar sem dados precisos." },
            ].map((p) => (
              <div key={p.label} className="bg-white p-7">
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">{p.label}</p>
                <p className="text-sm text-slate-600 leading-relaxed">{p.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ANTES × DEPOIS ── */}
      <section className="py-20 bg-slate-50 border-b border-slate-100">
        <div className="mx-auto max-w-4xl px-6">
          <p className="text-xs font-semibold text-blue-600 tracking-widest uppercase mb-4">O que muda na prática</p>
          <h2 className="text-3xl sm:text-4xl font-black mb-10 leading-tight">Antes e depois do SYSBUS</h2>

          <div className="space-y-2">
            <div className="grid sm:grid-cols-2 gap-px">
              <div className="rounded-tl-xl rounded-bl-none sm:rounded-bl-none rounded-tr-xl sm:rounded-tr-none bg-slate-200 px-5 py-2.5">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Situação atual</span>
              </div>
              <div className="rounded-bl-none rounded-br-xl sm:rounded-bl-none sm:rounded-tr-xl bg-blue-600 px-5 py-2.5">
                <span className="text-[11px] font-bold text-blue-100 uppercase tracking-widest">Com o SYSBUS 2.0</span>
              </div>
            </div>
            {COMPARISONS.map((item, i) => (
              <div key={i} className="grid sm:grid-cols-2 gap-px">
                <div className={`bg-white border border-slate-200 px-5 py-4 text-sm text-slate-600 leading-relaxed ${i === COMPARISONS.length - 1 ? "rounded-bl-xl" : ""}`}>
                  {item.before}
                </div>
                <div className={`bg-blue-50 border border-blue-100 px-5 py-4 text-sm text-slate-800 font-medium leading-relaxed flex items-start gap-2.5 ${i === COMPARISONS.length - 1 ? "rounded-br-xl" : ""}`}>
                  <CheckCircle className="mt-0.5 shrink-0 h-4 w-4 text-blue-500" />
                  {item.after}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FUNCIONALIDADES ── */}
      <section id="funcionamento" className="py-20 bg-white border-b border-slate-100">
        <div className="mx-auto max-w-6xl px-6">
          <p className="text-xs font-semibold text-blue-600 tracking-widest uppercase mb-4">O que o sistema oferece</p>
          <h2 className="text-3xl sm:text-4xl font-black mb-3 leading-tight max-w-lg">Uma plataforma, seis frentes de atuação</h2>
          <p className="text-sm text-slate-500 max-w-xl mb-12">Integrado entre secretaria, fiscal de campo e estudante. Funciona no computador, no tablet e no celular.</p>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map(({ Icon, title, desc }) => (
              <div key={title} className="group rounded-xl border border-slate-200 bg-white p-6 hover:border-blue-200 hover:shadow-md transition-all duration-200">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 group-hover:bg-blue-50 transition-colors mb-5">
                  <Icon className="h-5 w-5 text-slate-600 group-hover:text-blue-600 transition-colors" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm mb-2">{title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PARA QUEM ── */}
      <section className="py-20 bg-slate-50 border-b border-slate-100">
        <div className="mx-auto max-w-5xl px-6">
          <p className="text-xs font-semibold text-blue-600 tracking-widest uppercase mb-4">Para quem é o SYSBUS</p>
          <h2 className="text-3xl sm:text-4xl font-black mb-12 leading-tight">Cada área ganha algo concreto</h2>

          <div className="grid gap-5 sm:grid-cols-3">
            {FOR_WHO.map((card) => (
              <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-6">
                <h3 className="font-bold text-slate-900 text-sm mb-4 pb-4 border-b border-slate-100">{card.label}</h3>
                <ul className="space-y-2.5">
                  {card.points.map((pt) => (
                    <li key={pt} className="flex items-start gap-2.5 text-sm text-slate-600">
                      <CheckCircle className="mt-0.5 shrink-0 h-4 w-4 text-blue-500" />
                      {pt}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── IMPACTO ── */}
      <section className="py-20 bg-white border-b border-slate-100">
        <div className="mx-auto max-w-4xl px-6">
          <p className="text-xs font-semibold text-blue-600 tracking-widest uppercase mb-4">Impacto estimado</p>
          <h2 className="text-3xl sm:text-4xl font-black mb-3 leading-tight">O quanto isso representa para o seu município?</h2>
          <p className="text-sm text-slate-500 mb-10">Selecione o número aproximado de alunos atendidos pelo transporte público municipal.</p>

          <div className="flex flex-wrap gap-2 mb-10">
            {[500, 1000, 1500, 3000, 5000, 10000].map((n) => (
              <button
                key={n}
                onClick={() => setQtd(n)}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition-all ${
                  qtd === n
                    ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                    : "border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600 bg-white"
                }`}
              >
                {n.toLocaleString("pt-BR")} alunos
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingDown className="h-5 w-5 text-emerald-600" />
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Redução de insumos</span>
              </div>
              <p className="text-3xl font-black text-slate-900">{economiaAnual}</p>
              <p className="mt-2 text-xs text-slate-400">Estimativa de economia anual com a eliminação de papel e reemissões</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="h-5 w-5 text-blue-600" />
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Tempo recuperado</span>
              </div>
              <p className="text-3xl font-black text-slate-900">{horasPoupadas} horas</p>
              <p className="mt-2 text-xs text-slate-400">Horas de servidores liberadas por ano para atendimento e outras demandas</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <div className="flex items-center gap-2 mb-4">
                <Users className="h-5 w-5 text-violet-600" />
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Vagas recuperadas</span>
              </div>
              <p className="text-3xl font-black text-slate-900">~{vagasRecuperadas}</p>
              <p className="mt-2 text-xs text-slate-400">Assentos devolvidos a alunos de direito com o fim das caronas não autorizadas</p>
            </div>
          </div>

          <p className="text-xs text-slate-400 mt-5">
            Estimativas baseadas em referências de municípios de porte similar. Valores reais variam conforme o perfil local.
          </p>
        </div>
      </section>

      {/* ── IMPLEMENTAÇÃO ── */}
      <section className="py-20 bg-slate-50 border-b border-slate-100">
        <div className="mx-auto max-w-4xl px-6">
          <p className="text-xs font-semibold text-blue-600 tracking-widest uppercase mb-4">Implementação</p>
          <h2 className="text-3xl sm:text-4xl font-black mb-3 leading-tight">Em funcionamento em 4 semanas</h2>
          <p className="text-sm text-slate-500 mb-14 max-w-lg">A equipe da VannTec conduz todo o processo. A prefeitura não precisa ter equipe de TI.</p>

          <div className="grid gap-6 sm:grid-cols-4">
            {PHASES.map((phase) => (
              <div key={phase.n} className="relative">
                <p className="text-5xl font-black text-slate-100 select-none mb-3">{phase.n}</p>
                <h3 className="font-bold text-slate-900 text-sm mb-2">{phase.label}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{phase.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SEGURANÇA ── */}
      <section className="py-16 bg-white border-b border-slate-100">
        <div className="mx-auto max-w-4xl px-6">
          <div className="grid gap-8 sm:grid-cols-3 text-sm">
            <div>
              <ShieldCheck className="h-6 w-6 text-blue-600 mb-3" />
              <h3 className="font-bold text-slate-900 mb-1.5">Dados isolados por município</h3>
              <p className="text-slate-500 text-xs leading-relaxed">Cada prefeitura tem seus dados completamente separados no sistema. Nenhuma administração acessa informações de outra.</p>
            </div>
            <div>
              <BarChart3 className="h-6 w-6 text-blue-600 mb-3" />
              <h3 className="font-bold text-slate-900 mb-1.5">Conformidade com a LGPD</h3>
              <p className="text-slate-500 text-xs leading-relaxed">Dados de estudantes e responsáveis tratados com segurança, acessados apenas por quem tem permissão explícita no sistema.</p>
            </div>
            <div>
              <CheckCircle className="h-6 w-6 text-blue-600 mb-3" />
              <h3 className="font-bold text-slate-900 mb-1.5">Infraestrutura estável</h3>
              <p className="text-slate-500 text-xs leading-relaxed">Hospedagem em nuvem com backup diário automático e criptografia. Disponibilidade de 99,9% mesmo em dias de pico.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section id="contato" className="py-28 bg-slate-950 text-white">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <p className="text-xs font-semibold text-slate-400 tracking-widest uppercase mb-6">VannTec &nbsp;·&nbsp; SYSBUS 2.0</p>
          <h2 className="text-4xl sm:text-5xl font-black leading-tight mb-5">
            Pronto para modernizar o transporte escolar do seu município?
          </h2>
          <p className="text-slate-400 text-base max-w-xl mx-auto leading-relaxed mb-10">
            Fazemos uma demonstração completa do sistema, adaptada para a realidade da sua prefeitura. Sem custo, sem compromisso.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a
              href="https://wa.me/5587999999999?text=Olá,%20gostaria%20de%20agendar%20uma%20demonstração%20do%20SYSBUS%20para%20minha%20prefeitura."
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-7 py-3.5 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
            >
              <Phone className="h-4 w-4" />
              Falar pelo WhatsApp
            </a>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-6 py-3.5 text-sm font-medium text-slate-300 hover:bg-slate-900 transition-colors"
            >
              <Printer className="h-4 w-4" />
              Salvar como PDF
            </button>
          </div>
        </div>
      </section>

      <style>{`
        @media print {
          header { display: none !important; }
          body { background: white; color: #0f172a; }
        }
      `}</style>
    </div>
  );
}
