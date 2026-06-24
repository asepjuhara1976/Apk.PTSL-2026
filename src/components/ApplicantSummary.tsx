import React, { useState } from 'react';
import { 
  Search, 
  MapPin, 
  User, 
  Trash2, 
  Info, 
  FileSpreadsheet, 
  Check, 
  ChevronRight, 
  Compass, 
  Grid,
  Users,
  Edit,
  Edit3
} from 'lucide-react';
import { useApplicant, ApplicantData } from '../context/ApplicantContext.tsx';

interface Asset {
  id: number;
  userId: number | null;
  name: string;
  description: string;
  type: 'Point' | 'LineString' | 'Polygon';
  coordinates: any;
  properties: any;
}

interface ApplicantSummaryProps {
  assets: Asset[];
  userToken: string | null;
  onRefreshAssets: () => void;
  onSelectAssetAndGoToMap: (asset: Asset) => void;
  onNavigateToTab?: (tab: 'map' | 'pemohon' | 'data_summary') => void;
}

// Export Columns Definition matching 70+ PTSL Fields
const EXPORT_COLUMNS = [
  { key: 'no', label: 'NO' },
  { key: 'noRegister', label: 'NO REGISTER' },
  { key: 'tglWarkah', label: 'TGL WARKAH' },
  { key: 'desa', label: 'DESA' },
  { key: 'tahunPtsl', label: 'TAHUN PTSL' },
  { key: 'timPtsl', label: 'TIM PTSL' },
  { key: 'namaPuldadisDesa', label: 'NAMA PULDADIS DESA' },
  { key: 'namaPemohon', label: 'NAMA PEMOHON' },
  { key: 'nik', label: 'NIK' },
  { key: 'tempatLahir', label: 'TEMPAT LAHIR' },
  { key: 'tglLahir', label: 'TGL LAHIR' },
  { key: 'usia', label: 'USIA' },
  { key: 'agama', label: 'AGAMA' },
  { key: 'pekerjaan', label: 'PEKERJAAN' },
  { key: 'alamatPemohon', label: 'ALAMAT PEMOHON' },
  { key: 'noHp', label: 'NO HP' },
  { key: 'jalanBlok', label: 'JALAN/ BLOK' },
  { key: 'rt', label: 'RT' },
  { key: 'rw', label: 'RW' },
  { key: 'luasM2', label: 'LUAS M2' },
  { key: 'penggunaanTanah', label: 'PENGGUNAAN TANAH' },
  { key: 'batasUtara', label: 'BATAS UTARA' },
  { key: 'batasTimur', label: 'BATAS TIMUR' },
  { key: 'batasSelatan', label: 'BATAS SELATAN' },
  { key: 'batasBarat', label: 'BATAS BARAT' },
  { key: 'tahunPenguasaan', label: 'TAHUN PENGUASAAN OLEH PEMOHON' },
  { key: 'namaPemilikTerakhir', label: 'NAMA PEMILIK TERAKHIR SEBELUM PEMOHON' },
  { key: 'berdasarkan', label: 'BERDASARKAN' },
  { key: 'tahun1', label: 'TAHUN 1' },
  { key: 'namaPemilikAwal', label: 'NAMA PEMILIK AWAL' },
  { key: 'kohir', label: 'KOHIR' },
  { key: 'tahun2', label: 'TAHUN 2' },
  { key: 'namaPemilik2', label: 'NAMA PEMILIK 2' },
  { key: 'berdasarkan2', label: 'BERDASARKAN 2' },
  { key: 'tahun3', label: 'TAHUN 3' },
  { key: 'namaPemilik3', label: 'NAMA PEMILIK 3' },
  { key: 'berdasarkan3', label: 'BERDASARKAN 3' },
  { key: 'tahun4', label: 'TAHUN 4' },
  { key: 'namaPemilik4', label: 'NAMA PEMILIK 4' },
  { key: 'berdasarkan4', label: 'BERDASARKAN 4' },
  { key: 'tahun5', label: 'TAHUN 5' },
  { key: 'namaPemilik5', label: 'NAMA PEMILIK 5' },
  { key: 'berdasarkan5', label: 'BERDASARKAN 5' },
  { key: 'helper', label: 'HELPER' },
  { key: 'noAjb', label: 'NO AJB' },
  { key: 'tglAjb', label: 'TGL AJB' },
  { key: 'tahunAjb', label: 'TAHUN AJB' },
  { key: 'ppatAjb', label: 'PPAT AJB' },
  { key: 'namaPewaris', label: 'NAMA PEWARIS' },
  { key: 'tahunMeninggal', label: 'TAHUN MENINGGAL' },
  { key: 'noAktaHibah', label: 'NO AKTA HIBAH' },
  { key: 'tglAktaHibah', label: 'TGL AKTA HIBAH' },
  { key: 'tahunHibah', label: 'TAHUN HIBAH' },
  { key: 'ppatHibah', label: 'PPAT HIBAH' },
  { key: 'noAktaIkrarWakaf', label: 'NO AKTA IKRAR WAKAF' },
  { key: 'tglWakaf', label: 'TGL WAKAF' },
  { key: 'nadzirKetua', label: 'NADZIR KETUA' },
  { key: 'njop', label: 'NJOP' },
  { key: 'nop', label: 'NOP' },
  { key: 'nib', label: 'NIB' },
  { key: 'persil', label: 'PERSIL' },
  { key: 'kepalaDesa', label: 'KEPALA DESA' },
  { key: 'namaSaksi1', label: 'NAMA SAKSI  1' },
  { key: 'nikSaksi1', label: 'NIK SAKSI  1' },
  { key: 'agamaSaksi1', label: 'AGAMA SAKSI  1' },
  { key: 'usiaSaksi1', label: 'USIA SAKSI  1' },
  { key: 'pekerjaanSaksi1', label: 'PEKERJAAN SAKSI  1' },
  { key: 'alamatSaksi1', label: 'ALAMAT SAKSI  1' },
  { key: 'namaSaksi2', label: 'NAMA SAKSI  2' },
  { key: 'nikSaksi2', label: 'NIK SAKSI  2' },
  { key: 'agamaSaksi2', label: 'AGAMA SAKSI  2' },
  { key: 'usiaSaksi2', label: 'USIA SAKSI  2' },
  { key: 'pekerjaanSaksi2', label: 'PEKERJAAN SAKSI  2' },
  { key: 'alamatSaksi2', label: 'ALAMAT SAKSI  2' }
];

export const ApplicantSummary: React.FC<ApplicantSummaryProps> = ({
  assets,
  userToken,
  onRefreshAssets,
  onSelectAssetAndGoToMap,
  onNavigateToTab
}) => {
  const { updateMultipleDraftFields } = useApplicant();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedApplicant, setSelectedApplicant] = useState<ApplicantData | null>(null);
  const [selectedAssetOfApplicant, setSelectedAssetOfApplicant] = useState<Asset | null>(null);

  // Extract all assets that have applicantData inside properties
  const applicantsList = assets
    .filter(asset => asset.properties?.hasApplicant && asset.properties?.applicantData)
    .map(asset => ({
      asset,
      data: asset.properties.applicantData as ApplicantData
    }));

  // Export to CSV Function compatible with Excel
  const handleExportToExcel = () => {
    if (applicantsList.length === 0) {
      alert('Tidak ada data pemohon untuk diekspor!');
      return;
    }

    // CSV Headers
    const headers = EXPORT_COLUMNS.map(col => `"${col.label.replace(/"/g, '""')}"`).join(',');

    // CSV Rows
    const rows = applicantsList.map((item, idx) => {
      const data = item.data;
      return EXPORT_COLUMNS.map(col => {
        let value = '';
        if (col.key === 'no') {
          value = data.no || (idx + 1).toString();
        } else {
          value = (data as any)[col.key] || '';
        }
        // Escape quotes
        return `"${value.toString().replace(/"/g, '""')}"`;
      }).join(',');
    });

    const csvContent = '\uFEFF' + [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Rekap_Pemohon_PTSL_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Apply Search Filters
  const filteredApplicants = applicantsList.filter(item => {
    const term = searchTerm.toLowerCase();
    const nama = (item.data.namaPemohon || '').toLowerCase();
    const nik = (item.data.nik || '').toLowerCase();
    const desa = (item.data.desa || '').toLowerCase();
    const nReg = (item.data.noRegister || '').toLowerCase();

    return nama.includes(term) || nik.includes(term) || desa.includes(term) || nReg.includes(term);
  });

  const handleEditDraftFromApplicant = (item: { asset: Asset; data: ApplicantData }) => {
    if (confirm('Muat data pemohon ini kembali ke dalam formulir pengisian draf untuk mengedit?')) {
      updateMultipleDraftFields(item.data);
      alert('✓ DATA VALID: Berhasil memuat data pemohon ke halaman formulir! Anda dialihkan ke halaman edit sekarang.');
      if (onNavigateToTab) {
        onNavigateToTab('pemohon');
      }
    }
  };

  const handleDeleteApplicant = async (asset: Asset) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus data Pemohon dari aset "${asset.name}"? Geometri peta akan tetap dipertahankan.`)) return;

    // Remove applicant metadata from properties
    const updatedProperties = { ...(asset.properties || {}) };
    delete updatedProperties.applicantData;
    delete updatedProperties.hasApplicant;
    updatedProperties.color = '#4285F4'; // revert to default style color

    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (userToken) {
      headers['Authorization'] = `Bearer ${userToken}`;
    }

    try {
      const res = await fetch(`/api/assets/${asset.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          name: asset.name.split(' - ')[0], // clean up name
          description: '',
          type: asset.type,
          coordinates: asset.coordinates,
          properties: updatedProperties
        })
      });

      if (res.ok) {
        alert('✓ DATA VALID: Data pemohon berhasil dihapus dari database.');
        setSelectedApplicant(null);
        onRefreshAssets();
      } else {
        const err = await res.json();
        alert('Gagal menghapus: ' + (err.error || 'Server error'));
      }
    } catch (e: any) {
      alert('Terjadi kesalahan: ' + e.message);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6 flex flex-col gap-6" id="applicant_summary_page">
      
      {/* Banner / stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
        <div className="flex items-start gap-3.5">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 flex-shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2">
              Daftar & Rekap Pemohon PTSL
              <span className="text-[10px] bg-indigo-100 text-indigo-700 font-bold px-2.5 py-0.5 rounded-full uppercase">
                {applicantsList.length} Pemohon
              </span>
            </h2>
            <p className="text-slate-500 text-xs mt-0.5 max-w-xl">
              Lihat seluruh daftar nama pemohon yang terintegrasi secara langsung dengan koordinat dan berkas KML di database PostGIS.
            </p>
          </div>
        </div>

        {/* Search bar & Export Excel Button */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-64 md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nama, NIK, register, atau desa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl pl-10 pr-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-100 font-medium transition-all"
            />
          </div>

          <button
            onClick={handleExportToExcel}
            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm shadow-emerald-600/10 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            title="Ekspor seluruh 74 kolom data pemohon ke format Excel CSV"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Ekspor Excel</span>
          </button>
        </div>
      </div>

      {/* Grid of Applicants Table and Viewer */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        
        {/* Table column */}
        <div className="xl:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-700">Daftar Pemohon Terdaftar</h3>
            <span className="text-[10px] font-mono font-bold bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
              Showing {filteredApplicants.length} records
            </span>
          </div>

          {filteredApplicants.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center gap-2">
              <FileSpreadsheet className="w-10 h-10 text-slate-300" />
              <p className="text-sm font-bold text-slate-700">Belum Ada Data Pemohon</p>
              <p className="text-xs text-slate-400 max-w-sm">
                Isi formulir pendaftaran 70 kolom dan integrasikan ke aset geometris / file KML untuk menampilkan daftarnya di sini.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200">
                    <th className="p-4">No Reg</th>
                    <th className="p-4">Nama Pemohon</th>
                    <th className="p-4">NIK</th>
                    <th className="p-4">Desa / Luas</th>
                    <th className="p-4">Aset KML Terkait</th>
                    <th className="p-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredApplicants.map((item, idx) => (
                    <tr 
                      key={item.asset.id} 
                      className={`hover:bg-slate-50/70 transition-colors group cursor-pointer ${
                        selectedApplicant?.nik === item.data.nik ? 'bg-indigo-50/30 font-medium' : ''
                      }`}
                      onClick={() => {
                        setSelectedApplicant(item.data);
                        setSelectedAssetOfApplicant(item.asset);
                      }}
                    >
                      <td className="p-4 font-mono text-[11px] text-slate-500">
                        {item.data.noRegister || item.data.no || `REG-${idx+1}`}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-indigo-50 border border-indigo-150 flex items-center justify-center text-indigo-700 text-[10px] font-bold uppercase font-mono">
                            {item.data.namaPemohon.substring(0, 2)}
                          </div>
                          <span className="text-slate-800 font-semibold">{item.data.namaPemohon}</span>
                        </div>
                      </td>
                      <td className="p-4 font-mono text-[11px] text-slate-600">
                        {item.data.nik || '-'}
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="text-slate-700 font-semibold">{item.data.desa || '-'}</span>
                          <span className="text-[10px] text-slate-400 font-medium">{item.data.luasM2 ? `${item.data.luasM2} m²` : '-'}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center gap-1 text-[10px] bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md font-bold text-slate-600">
                          <MapPin className="w-3 h-3 text-indigo-500" />
                          {item.asset.name}
                        </span>
                      </td>
                      <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => onSelectAssetAndGoToMap(item.asset)}
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg border border-transparent hover:border-indigo-100 transition-all cursor-pointer"
                            title="Tunjukkan di Peta"
                          >
                            <Compass className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEditDraftFromApplicant(item)}
                            className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg border border-transparent transition-all cursor-pointer"
                            title="Muat Ulang Ke Form"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteApplicant(item.asset)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-100 transition-all cursor-pointer"
                            title="Hapus Data Pemohon"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Detail Inspector Column */}
        <div className="xl:col-span-1 bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-4">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-indigo-500" /> Inspektur Data Pemohon
            </h3>
            {selectedApplicant && (
              <button
                onClick={() => setSelectedApplicant(null)}
                className="text-[10px] text-slate-400 hover:text-slate-600 font-semibold"
              >
                Clear
              </button>
            )}
          </div>

          {selectedApplicant ? (
            <div className="space-y-5 animate-fade-in text-xs max-h-[500px] overflow-y-auto pr-1">
              
              {/* Core header */}
              <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 flex flex-col gap-1">
                <span className="text-[9px] font-mono font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md w-fit uppercase">
                  Reg: {selectedApplicant.noRegister || 'N/A'}
                </span>
                <h4 className="text-sm font-bold text-slate-800 mt-1">{selectedApplicant.namaPemohon}</h4>
                <p className="text-slate-500 font-mono text-[11px]">NIK: {selectedApplicant.nik || '-'}</p>

                {selectedAssetOfApplicant && (
                  <div className="mt-3.5 space-y-2">
                    <button
                      onClick={() => onSelectAssetAndGoToMap(selectedAssetOfApplicant)}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-[11px] flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
                    >
                      <Compass className="w-3.5 h-3.5" />
                      Tunjukkan Koordinat Bidang di Peta
                    </button>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleEditDraftFromApplicant({ asset: selectedAssetOfApplicant, data: selectedApplicant })}
                        className="py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg text-[11px] flex items-center justify-center gap-1 transition-all shadow-sm cursor-pointer"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        Edit Data
                      </button>
                      <button
                        onClick={() => handleDeleteApplicant(selectedAssetOfApplicant)}
                        className="py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-[11px] flex items-center justify-center gap-1 transition-all shadow-sm cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Hapus Data
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Collapsible/Grouped details of the 70 columns */}
              <div className="space-y-4">
                
                {/* 1. Bidang Tanah */}
                <div className="space-y-2">
                  <h5 className="font-bold text-indigo-600 text-[10px] uppercase tracking-wider border-b border-indigo-100 pb-1">1. Detail Bidang Tanah</h5>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-400">Desa</span>
                      <p className="font-semibold text-slate-800">{selectedApplicant.desa || '-'}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Luas (M²)</span>
                      <p className="font-semibold text-slate-800">{selectedApplicant.luasM2 || '-'} m²</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Penggunaan</span>
                      <p className="font-semibold text-slate-800">{selectedApplicant.penggunaanTanah || '-'}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Tgl Warkah</span>
                      <p className="font-semibold text-slate-800">{selectedApplicant.tglWarkah || '-'}</p>
                    </div>
                    <div className="col-span-2 bg-slate-50 p-2 rounded-lg border border-slate-100 grid grid-cols-2 gap-1.5 text-[10px]">
                      <div>
                        <span className="text-slate-400">Batas Utara</span>
                        <p className="font-semibold text-slate-700">{selectedApplicant.batasUtara || '-'}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Batas Timur</span>
                        <p className="font-semibold text-slate-700">{selectedApplicant.batasTimur || '-'}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Batas Selatan</span>
                        <p className="font-semibold text-slate-700">{selectedApplicant.batasSelatan || '-'}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Batas Barat</span>
                        <p className="font-semibold text-slate-700">{selectedApplicant.batasBarat || '-'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Riwayat Hak & Dokumen */}
                <div className="space-y-2">
                  <h5 className="font-bold text-indigo-600 text-[10px] uppercase tracking-wider border-b border-indigo-100 pb-1">2. Riwayat Hak & Dokumen</h5>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-400">Tahun Penguasaan</span>
                      <p className="font-semibold text-slate-800">{selectedApplicant.tahunPenguasaan || '-'}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Pemilik Terakhir</span>
                      <p className="font-semibold text-slate-800">{selectedApplicant.namaPemilikTerakhir || '-'}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Berdasarkan</span>
                      <p className="font-semibold text-slate-800">{selectedApplicant.berdasarkan || '-'}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">NIB</span>
                      <p className="font-semibold text-slate-800">{selectedApplicant.nib || '-'}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Nomor NOP</span>
                      <p className="font-semibold text-slate-800">{selectedApplicant.nop || '-'}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Nomor Persil</span>
                      <p className="font-semibold text-slate-800">{selectedApplicant.persil || '-'}</p>
                    </div>
                    {selectedApplicant.noAjb && (
                      <div className="col-span-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400">DOKUMEN AJB:</span>
                        <p className="font-semibold text-slate-700 mt-0.5">No. {selectedApplicant.noAjb} ({selectedApplicant.tglAjb || 'N/A'})</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">PPAT: {selectedApplicant.ppatAjb || '-'}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. Saksi-Saksi */}
                <div className="space-y-2">
                  <h5 className="font-bold text-indigo-600 text-[10px] uppercase tracking-wider border-b border-indigo-100 pb-1">3. Saksi-Saksi PTSL</h5>
                  <div className="space-y-2 text-[11px]">
                    <div className="bg-slate-50/50 p-2.5 border border-slate-150 rounded-xl">
                      <span className="text-[10px] font-bold text-indigo-500 uppercase">Saksi 1:</span>
                      <p className="font-bold text-slate-800 mt-0.5">{selectedApplicant.namaSaksi1 || '-'}</p>
                      <p className="text-slate-500 text-[10px] font-mono mt-0.5">NIK: {selectedApplicant.nikSaksi1 || '-'}</p>
                      <p className="text-slate-400 text-[10px] mt-0.5">Alamat: {selectedApplicant.alamatSaksi1 || '-'}</p>
                    </div>
                    <div className="bg-slate-50/50 p-2.5 border border-slate-150 rounded-xl">
                      <span className="text-[10px] font-bold text-indigo-500 uppercase">Saksi 2:</span>
                      <p className="font-bold text-slate-800 mt-0.5">{selectedApplicant.namaSaksi2 || '-'}</p>
                      <p className="text-slate-500 text-[10px] font-mono mt-0.5">NIK: {selectedApplicant.nikSaksi2 || '-'}</p>
                      <p className="text-slate-400 text-[10px] mt-0.5">Alamat: {selectedApplicant.alamatSaksi2 || '-'}</p>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          ) : (
            <div className="p-8 text-center flex flex-col items-center justify-center gap-1.5">
              <User className="w-8 h-8 text-slate-300" />
              <p className="text-xs font-bold text-slate-700">Pilih Pemohon</p>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Klik salah satu baris tabel di samping untuk melihat rincian 70 kolom data pendaftaran secara lengkap.
              </p>
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
