import React, { useEffect, useState } from 'react';
import { Download, Filter, Calendar, BarChart2 } from 'lucide-react';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../src/firebase';
import { Conversation, Agent } from '../types';
import { getAgents } from '../services/agentsService';

const Reports: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10)); // Today
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedAgent, setSelectedAgent] = useState('ALL');

  useEffect(() => {
    const init = async () => {
      const agentsData = await getAgents();
      setAgents(agentsData);
      await fetchReports();
    };
    init();
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    try {
      // Basic query for closed conversations
      // Note: Complex querying with multiple inequalities requires composite indexes.
      // For MVP, we fetch closed conversations ordered by date and filter in client if needed,
      // or use simple date range query.
      
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      const q = query(
        collection(db, 'conversations'),
        where('status', '==', 'CLOSED'),
        where('updatedAt', '>=', Timestamp.fromDate(start)),
        where('updatedAt', '<=', Timestamp.fromDate(end)),
        orderBy('updatedAt', 'desc')
      );

      const snapshot = await getDocs(q);
      let data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Conversation));

      if (selectedAgent !== 'ALL') {
        data = data.filter(c => c.assignedAgentId === selectedAgent);
      }

      setConversations(data);
    } catch (error) {
      console.error("Error fetching reports:", error);
      alert("Error cargando reportes. Verifica si el índice compuesto está creado en Firebase.");
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    const headers = ["ID", "Ciudadano", "Canal", "Agente", "Inicio", "Fin", "Duración (min)", "Motivo Cierre", "Nota"];
    
    const rows = conversations.map(c => {
      const agentName = agents.find(a => a.id === c.assignedAgentId)?.displayName || 'Desconocido';
      const start = c.createdAt?.toDate ? c.createdAt.toDate() : new Date();
      const end = c.updatedAt?.toDate ? c.updatedAt.toDate() : new Date();
      const duration = Math.round((end.getTime() - start.getTime()) / 60000); // minutes

      return [
        c.id,
        c.citizenId,
        c.sourceChannel,
        agentName,
        start.toLocaleString(),
        end.toLocaleString(),
        duration,
        c.disposition || '',
        `"${(c.closingNotes || '').replace(/"/g, '""')}"` // Escape quotes for CSV
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n" 
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `reporte_dsac_${startDate}_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getAgentName = (id: string | null) => agents.find(a => a.id === id)?.displayName || 'N/A';

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Reportes de Gestión</h1>
          <p className="text-gray-500 text-sm">Auditoría y exportación de casos cerrados.</p>
        </div>
        <button 
          onClick={exportCSV} 
          disabled={loading || conversations.length === 0}
          className="bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-800 transition disabled:opacity-50"
        >
          <Download size={18} /> Exportar CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fecha Inicio</label>
          <input 
            type="date" 
            className="border border-gray-300 rounded px-3 py-2 text-sm" 
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fecha Fin</label>
          <input 
            type="date" 
            className="border border-gray-300 rounded px-3 py-2 text-sm" 
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Agente</label>
          <select 
            className="border border-gray-300 rounded px-3 py-2 text-sm min-w-[200px]"
            value={selectedAgent}
            onChange={e => setSelectedAgent(e.target.value)}
          >
            <option value="ALL">Todos los Agentes</option>
            {agents.map(a => (
              <option key={a.id} value={a.id}>{a.displayName}</option>
            ))}
          </select>
        </div>
        <button 
          onClick={fetchReports}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition"
        >
          <Filter size={18} /> Filtrar
        </button>
      </div>

      {/* Stats Summary */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
             <p className="text-xs text-gray-500 uppercase font-bold">Total Casos Cerrados</p>
             <p className="text-2xl font-bold text-gray-800">{conversations.length}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
             <p className="text-xs text-gray-500 uppercase font-bold">Duración Promedio</p>
             <p className="text-2xl font-bold text-gray-800">
               {conversations.length > 0 
                 ? Math.round(conversations.reduce((acc, c) => {
                     const start = c.createdAt?.toDate ? c.createdAt.toDate().getTime() : 0;
                     const end = c.updatedAt?.toDate ? c.updatedAt.toDate().getTime() : 0;
                     return acc + (end - start);
                   }, 0) / conversations.length / 60000) 
                 : 0} min
             </p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">Cargando datos...</div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-500 font-medium text-xs uppercase tracking-wider">
              <tr>
                <th className="p-4">Fecha Cierre</th>
                <th className="p-4">Ciudadano</th>
                <th className="p-4">Agente</th>
                <th className="p-4">Canal</th>
                <th className="p-4">Motivo</th>
                <th className="p-4">Nota</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {conversations.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="p-4 whitespace-nowrap">
                    {c.updatedAt?.toDate ? c.updatedAt.toDate().toLocaleString() : 'N/A'}
                  </td>
                  <td className="p-4 font-medium text-gray-800">{c.citizenId}</td>
                  <td className="p-4 text-gray-600">{getAgentName(c.assignedAgentId)}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${c.sourceChannel === 'whatsapp' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                      {c.sourceChannel === 'whatsapp' ? 'WhatsApp' : 'Web'}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="bg-gray-100 px-2 py-1 rounded text-xs">{c.disposition || 'N/A'}</span>
                  </td>
                  <td className="p-4 text-gray-500 truncate max-w-xs" title={c.closingNotes || ''}>
                    {c.closingNotes || '-'}
                  </td>
                </tr>
              ))}
              {conversations.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-400">
                    No se encontraron reportes en este rango de fechas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Reports;