import { useMemo, useState } from 'react'
import { toArabicNumerals } from '../lib/paperModel'

const norm = (s) => String(s || '').toLowerCase()

export default function Dashboard({ user, papers, folders, onOpen, onNew, onDelete, onDuplicate, onMove, onAddFolder, onRenameFolder, onDeleteFolder, onSettings, onLogout }) {
  const [search, setSearch] = useState('')
  const [folder, setFolder] = useState('all') // 'all' | 'none' | folderId

  const counts = useMemo(() => {
    const c = { all: papers.length, none: 0 }
    papers.forEach((p) => { if (p.folderId && folders.some((f) => f.id === p.folderId)) c[p.folderId] = (c[p.folderId] || 0) + 1; else c.none += 1 })
    return c
  }, [papers, folders])

  const visible = useMemo(() => {
    const q = norm(search).trim()
    return papers
      .filter((p) => {
        const inFolder = p.folderId && folders.some((f) => f.id === p.folderId)
        if (folder === 'none' && inFolder) return false
        if (folder !== 'all' && folder !== 'none' && p.folderId !== folder) return false
        if (!q) return true
        const hay = [p.header?.className, p.header?.examName, p.header?.paperNumber, p.header?.hijriYear, ...(p.subjects || []).map((s) => s.title)].map(norm).join(' ')
        return q.split(/\s+/).every((w) => hay.includes(w))
      })
      .sort((a, b) => String(b.lastEdited || '').localeCompare(String(a.lastEdited || '')))
  }, [papers, folders, search, folder])

  const activeFolder = folders.find((f) => f.id === folder)
  const chip = (id, label, count) => (
    <button key={id} type="button" onClick={() => setFolder(id)} className={`px-3 py-1.5 rounded-full text-sm font-medium border transition whitespace-nowrap ${folder === id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>
      <span className={id !== 'all' && id !== 'none' ? 'font-arabic' : ''}>{label}</span> <span className={`text-xs ${folder === id ? 'text-blue-100' : 'text-gray-400'}`}>{count || 0}</span>
    </button>
  )

  const createFolder = () => { const name = window.prompt('New folder name'); if (name && name.trim()) onAddFolder(name.trim()) }

  return (
    <div className="p-4 md:p-6 flex-grow">
      <nav className="bg-white p-4 rounded-lg shadow-sm mb-8 flex justify-between items-center max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-3">
          {user?.photoURL && <img src={user.photoURL} alt="Profile" className="w-10 h-10 rounded-full border border-gray-200" />}
          <div>
            <h1 className="text-base md:text-lg font-bold text-gray-800">{user?.displayName}</h1>
            <p className="text-xs text-gray-500">{user?.email}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onSettings} className="text-gray-600 hover:bg-gray-100 px-3 py-2 rounded text-sm font-medium transition">⚙️ Settings</button>
          <button onClick={onLogout} className="text-red-500 hover:bg-red-50 px-3 py-2 rounded text-sm font-medium transition">Logout</button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3 mb-4">
          <h2 className="text-2xl font-bold text-gray-800">My Papers</h2>
          <button onClick={onNew} className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 font-bold shadow-sm text-sm transition self-start sm:self-auto">+ New Paper</button>
        </div>

        <div className="relative mb-4">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by class, exam, subject, paper no…" className="w-full bg-white border border-gray-200 rounded-lg pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:border-blue-400" />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 items-center">
          {chip('all', 'All', counts.all)}
          {chip('none', 'Unfiled', counts.none)}
          {folders.map((f) => chip(f.id, `📁 ${f.name}`, counts[f.id]))}
          <button type="button" onClick={createFolder} className="px-3 py-1.5 rounded-full text-sm font-medium border border-dashed border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-600 whitespace-nowrap">+ New folder</button>
        </div>

        {activeFolder && (
          <div className="flex gap-3 text-xs mb-4 text-gray-500">
            <span>Folder: <b className="text-gray-700">{activeFolder.name}</b></span>
            <button type="button" onClick={() => { const n = window.prompt('Rename folder', activeFolder.name); if (n && n.trim()) onRenameFolder(activeFolder.id, n.trim()) }} className="hover:text-blue-600">Rename</button>
            <button type="button" onClick={() => { if (window.confirm(`Delete folder "${activeFolder.name}"? Its papers are kept and move to Unfiled.`)) { onDeleteFolder(activeFolder.id); setFolder('all') } }} className="hover:text-red-600">Delete folder</button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {visible.length === 0 ? (
            <p className="text-gray-500 col-span-full text-center py-10 bg-white rounded-lg shadow-sm border border-dashed border-gray-300">
              {papers.length === 0 ? 'No papers saved yet. Create your first one!' : 'No papers match your search / folder.'}
            </p>
          ) : visible.map((paper) => (
            <div key={paper.id} onClick={() => onOpen(paper)} className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 hover:border-blue-400 hover:shadow-md transition cursor-pointer relative group">
              <div className="absolute top-3 right-3 flex gap-2 text-gray-300 opacity-0 group-hover:opacity-100 focus-within:opacity-100 max-sm:opacity-100 transition">
                <button onClick={(e) => { e.stopPropagation(); onDuplicate(paper) }} className="hover:text-blue-500" title="Duplicate">📄</button>
                <button onClick={(e) => { e.stopPropagation(); onDelete(paper.id) }} className="hover:text-red-500" title="Delete Paper">🗑️</button>
              </div>
              <div className="bg-blue-50 text-blue-700 text-xs font-bold px-2 py-1 rounded inline-block mb-3 font-arabic" dir="rtl">{paper.header?.className || 'Unknown'}</div>
              <h3 className="text-lg font-bold mb-1 font-arabic text-gray-800 leading-tight" dir="rtl">{paper.header?.examName || 'Untitled'} {toArabicNumerals(paper.header?.hijriYear || '')}هـ</h3>
              <p className="text-gray-500 text-xs mb-2 font-serif font-medium">{paper.header?.paperNumber || ''}</p>
              <p className="text-xs text-gray-400 font-medium font-arabic" dir="rtl">{(paper.subjects || []).map((s) => s.title).filter(Boolean).join('، ') || '—'}</p>
              <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                <select value={folders.some((f) => f.id === paper.folderId) ? paper.folderId : ''} onChange={(e) => onMove(paper.id, e.target.value || null)} className="text-xs border border-gray-200 rounded px-1.5 py-1 text-gray-500 bg-white max-w-full" aria-label="Move to folder">
                  <option value="">📂 Unfiled</option>
                  {folders.map((f) => <option key={f.id} value={f.id}>📁 {f.name}</option>)}
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
