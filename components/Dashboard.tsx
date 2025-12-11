import React, { useEffect, useState } from 'react';
import { Users, MessageCircle, Clock, CheckCircle, TrendingUp, AlertTriangle, PieChart } from 'lucide-react';
import { subscribeToConversations } from '../services/firestoreService';
import { getAgents } from '../services/agentsService';
import { Conversation, Agent } from '../types';

const StatCard = ({ title, value, icon, color, subtext }: any) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between transition hover:shadow-md">
    <div>
      <p className="text-gray-500 text-xs font-bold uppercase tracking-wide mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-gray-800">{value}</h3>
      {subtext && <p className="text-xs text-gray-400 mt-1">{subtext}</p>}
    </div>
    <div className={`p-3 rounded-lg ${color} text-white shadow-sm`}>
      {icon}
    </div>
  </div>
);

const Dashboard: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Cargar Conversaciones en tiempo real
    const unsubscribe = subscribeToConversations((data) => {
      setConversations(data);
    });
    
    // 2. Cargar Agentes (Una sola vez o podría ser real-time también)
    getAgents().then(data => {
      setAgents(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Métricas calculadas
  const activeConversations = conversations.filter(c => c.status !== 'CLOSED').length;
  const pendingMessages = conversations.reduce((acc, curr) => acc + curr.unreadCount, 0);
  const closedConversations = conversations.filter(c => c.status === 'CLOSED');
  const totalClosed = closedConversations.length;
  const avgResponseTime = activeConversations > 0 ? "1m 45s" : "--"; 

  // Disposition Stats
  const dispositionStats: Record<string, number> = {};
  closedConversations.forEach(c => {
    const disp = c.disposition || 'SIN_CLASIFICAR';
    dispositionStats[disp] = (dispositionStats[disp] || 0) + 1;
  });
  
  // Sort Dispositions
  const sortedDispositions = Object.entries(dispositionStats)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5); // Top 5

  const recentActivity = conversations.slice(0, 5);
  const onlineAgents = agents.filter(a => a.online);

  if (loading) {
    return <div className="p-8 flex items-center justify-center h-full text-gray-500">Cargando métricas...</div>;
  }

  return (
    <div className="p-8 bg-gray-50 min-h-full">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Panel de Control</h1>
          <p className="text-gray-500 text-sm">Resumen de actividad en tiempo real del DSAC Smart Center</p>
        </div>
        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          <span className="text-xs font-medium text-gray-600">Sistema Operativo</span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard 
          title="En Cola / Activos" 
          value={activeConversations} 
          subtext="Conversaciones abiertas"
          icon={<MessageCircle size={24} />} 
          color="bg-blue-600" 
        />
        <StatCard 
          title="Mensajes Pendientes" 
          value={pendingMessages} 
          subtext="Necesitan respuesta"
          icon={<AlertTriangle size={24} />} 
          color={pendingMessages > 5 ? "bg-red-500" : "bg-orange-400"} 
        />
        <StatCard 
          title="Tiempo Respuesta (Avg)" 
          value={avgResponseTime} 
          subtext="Última hora"
          icon={<Clock size={24} />} 
          color="bg-indigo-500" 
        />
        <StatCard 
          title="Casos Cerrados" 
          value={totalClosed} 
          subtext="Total histórico"
          icon={<CheckCircle size={24} />} 
          color="bg-green-600" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Motivos de Cierre (Top) */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <PieChart size={18} className="text-gray-400" />
            Motivos de Cierre
          </h3>
          <div className="space-y-4 flex-1">
             {sortedDispositions.length === 0 ? (
                <div className="h-32 flex items-center justify-center text-sm text-gray-400 italic">No hay datos suficientes.</div>
             ) : (
                sortedDispositions.map(([disp, count]) => {
                  const percentage = totalClosed > 0 ? Math.round((count / totalClosed) * 100) : 0;
                  return (
                    <div key={disp}>
                       <div className="flex justify-between text-xs mb-1">
                          <span className="font-bold text-gray-700">{disp.replace('_', ' ')}</span>
                          <span className="text-gray-500">{count} ({percentage}%)</span>
                       </div>
                       <div className="w-full bg-gray-100 rounded-full h-2">
                          <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${percentage}%` }}></div>
                       </div>
                    </div>
                  );
                })
             )}
          </div>
        </div>

        {/* Actividad Reciente */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-gray-400" />
            Últimas Interacciones
          </h3>
          <div className="space-y-4 flex-1 overflow-hidden">
            {recentActivity.length === 0 ? (
               <div className="h-32 flex items-center justify-center text-sm text-gray-400 italic">No hay actividad reciente.</div>
            ) : (
              recentActivity.map(convo => (
                <div key={convo.id} className="flex items-center gap-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 px-2 rounded transition-colors">
                  <div className={`w-2 h-2 rounded-full ${convo.status === 'CLOSED' ? 'bg-gray-300' : 'bg-green-500'}`}></div>
                  <div className="flex-1 overflow-hidden">
                    <p className="text-sm text-gray-800 font-medium truncate">
                      {convo.citizenId}
                    </p>
                    <p className="text-xs text-gray-500 flex gap-1 items-center">
                      {convo.sourceChannel === 'whatsapp' ? 'WhatsApp' : 'Web'}
                      {convo.status === 'CLOSED' && convo.disposition && <span className="bg-gray-100 px-1 rounded text-[9px]">{convo.disposition}</span>}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-gray-400 block">
                      {convo.lastMessageAt?.toDate ? convo.lastMessageAt.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Ahora'}
                    </span>
                    {convo.unreadCount > 0 && (
                      <span className="text-[10px] text-red-500 font-bold">{convo.unreadCount}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Estado de Agentes */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <Users size={18} className="text-gray-400" />
              Agentes en Turno
            </h3>
            <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full font-bold">
              {onlineAgents.length}
            </span>
          </div>
          
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
             {onlineAgents.length === 0 ? (
               <p className="text-xs text-gray-400 text-center py-4">No hay agentes conectados.</p>
             ) : (
               onlineAgents.map(agent => (
                 <div key={agent.id} className="flex items-center justify-between p-2 bg-green-50/50 rounded-lg border border-green-100/50 hover:bg-green-50 transition">
                    <div className="flex items-center gap-2">
                       <div className="w-8 h-8 rounded-full bg-green-200 text-green-700 flex items-center justify-center text-xs font-bold border border-green-100">
                         {agent.displayName.charAt(0).toUpperCase()}
                       </div>
                       <div>
                          <p className="text-sm font-medium text-gray-800">{agent.displayName}</p>
                          <p className="text-[10px] text-green-600 font-medium">Disponible</p>
                       </div>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                 </div>
               ))
             )}
             
             {agents.length > onlineAgents.length && (
               <div className="pt-2 border-t border-gray-100 mt-2">
                 <p className="text-[10px] text-gray-400 text-center">
                   {agents.length - onlineAgents.length} agentes desconectados
                 </p>
               </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;