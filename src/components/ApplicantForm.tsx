import React, { useState, useEffect } from 'react';
import { useApplicant, ApplicantData } from '../context/ApplicantContext.tsx';
import { 
  User, 
  MapPin, 
  ShieldCheck, 
  Users, 
  Save, 
  Trash2, 
  CheckCircle, 
  Compass, 
  FileSpreadsheet,
  Link,
  Info
} from 'lucide-react';

interface Asset {
  id: number;
  userId: number | null;
  name: string;
  description: string;
  type: 'Point' | 'LineString' | 'Polygon';
  coordinates: any;
  properties: any;
}

interface ApplicantFormProps {
  assets: Asset[];
  userToken: string | null;
  onRefreshAssets: () => void;
  onNavigateToMap: () => void;
  onSelectAssetAndGoToMap?: (asset: Asset) => void;
}

export const ApplicantForm: React.FC<ApplicantFormProps> = ({ 
  assets, 
  userToken, 
  onRefreshAssets,
  onNavigateToMap,
  onSelectAssetAndGoToMap
}) => {
  const { draft, updateDraftField, updateMultipleDraftFields, clearDraft, saveDraftToStorage } = useApplicant();
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [selectedAssetId, setSelectedAssetId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [useGpsForNewAsset, setUseGpsForNewAsset] = useState(false);
  const [assetSearchTerm, setAssetSearchTerm] = useState('');

  // Helper to find KML asset by number/name matched with "No" field
  const findMatchingAsset = (noVal: string) => {
    if (!noVal || !noVal.trim()) return null;
    const cleanVal = noVal.trim().toLowerCase();
    
    // 1. Try exact name match
    let match = assets.find(a => a.name.trim().toLowerCase() === cleanVal);
    if (match) return match;
    
    // 2. Try match after stripping leading zeros (e.g., "001" matches "1" or "01")
    const cleanNoZeros = cleanVal.replace(/^0+/, '');
    match = assets.find(a => {
      const nameNoZeros = a.name.trim().toLowerCase().replace(/^0+/, '');
      return nameNoZeros === cleanNoZeros && cleanNoZeros !== '';
    });
    if (match) return match;

    // 3. Try partial/inclusion matches
    match = assets.find(a => {
      const normName = a.name.trim().toLowerCase();
      return normName.includes(cleanVal) || cleanVal.includes(normName);
    });
    return match;
  };

  // Auto-populate sequence numbers if empty
  useEffect(() => {
    const registeredCount = assets.filter(asset => asset.properties?.hasApplicant || asset.properties?.applicantData).length;
    const nextSeq = registeredCount + 1;
    
    if (!draft.no) {
      updateDraftField('no', nextSeq.toString());
    }
    
    if (!draft.noRegister) {
      const currentYear = new Date().getFullYear();
      const autoRegNum = `REG/${currentYear}/${String(nextSeq).padStart(3, '0')}`;
      updateDraftField('noRegister', autoRegNum);
    }
  }, [assets, draft.noRegister, draft.no]);

  // Synchronize KML linkage whenever 'no' field changes
  useEffect(() => {
    if (draft.no) {
      const matched = findMatchingAsset(draft.no);
      if (matched) {
        setSelectedAssetId(matched.id.toString());
      }
    }
  }, [draft.no, assets]);

  // Helper to calculate approximate area of a polygon in m²
  const calculatePolygonArea = (coordinates: any): number => {
    if (!coordinates) return 0;
    
    let coords: { lat: number; lng: number }[] = [];
    if (Array.isArray(coordinates)) {
      if (Array.isArray(coordinates[0])) {
        coords = coordinates[0];
      } else {
        coords = coordinates;
      }
    }
    
    if (coords.length < 3) return 0;
    
    const ref = coords[0];
    const r = 6371000; // Earth's radius in meters
    const points = coords.map(c => {
      const x = c.lng * (Math.PI / 180) * r * Math.cos(ref.lat * Math.PI / 180);
      const y = c.lat * (Math.PI / 180) * r;
      return { x, y };
    });
    
    let area = 0;
    const n = points.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += points[i].x * points[j].y;
      area -= points[j].x * points[i].y;
    }
    return Math.round(Math.abs(area / 2));
  };

  // Filter KML assets based on search query
  const filteredAssets = assets.filter(asset => {
    if (!assetSearchTerm) return true;
    const term = assetSearchTerm.toLowerCase();
    return (
      asset.name.toLowerCase().includes(term) ||
      (asset.description && asset.description.toLowerCase().includes(term))
    );
  });

  // Schema groupings for render
  const sections = {
    1: {
      title: 'Bagian 1: Identitas Pemohon & Bidang Tanah (Kolom 1 - 25)',
      description: 'Lengkapi data pribadi pemohon, nomor registrasi, serta detail letak dan luas bidang tanah.',
      fields: [
        { id: 'no', label: 'NO', placeholder: 'Contoh: 1', type: 'text' },
        { id: 'noRegister', label: 'NO REGISTER', placeholder: 'Contoh: REG/2026/001', type: 'text' },
        { id: 'tglWarkah', label: 'TANGGAL WARKAH', placeholder: 'YYYY-MM-DD', type: 'date' },
        { id: 'desa', label: 'DESA / KELURAHAN', placeholder: 'Contoh: Sukamakmur', type: 'text' },
        { id: 'tahunPtsl', label: 'TAHUN PTSL', placeholder: 'Contoh: 2026', type: 'text' },
        { id: 'timPtsl', label: 'TIM PTSL', placeholder: 'Contoh: Tim IV', type: 'text' },
        { id: 'namaPuldadisDesa', label: 'NAMA PULDADIS DESA', placeholder: 'Nama Petugas Puldadis', type: 'text' },
        { id: 'namaPemohon', label: 'NAMA LENGKAP PEMOHON', placeholder: 'Nama Sesuai KTP', type: 'text', required: true },
        { id: 'nik', label: 'NIK (NOMOR INDUK KEPENDUDUKAN)', placeholder: '16-Digit NIK', type: 'text' },
        { id: 'tempatLahir', label: 'TEMPAT LAHIR', placeholder: 'Kabupaten/Kota lahir', type: 'text' },
        { id: 'tglLahir', label: 'TANGGAL LAHIR', type: 'date' },
        { id: 'usia', label: 'USIA (TAHUN)', placeholder: 'Contoh: 45', type: 'number' },
        { id: 'agama', label: 'AGAMA', placeholder: 'Islam/Kristen/Katolik/Hindu/Budha/Khonghucu', type: 'text' },
        { id: 'pekerjaan', label: 'PEKERJAAN', placeholder: 'Contoh: Wiraswasta', type: 'text' },
        { id: 'alamatPemohon', label: 'ALAMAT LENGKAP PEMOHON', placeholder: 'Jalan, Dusun, RT/RW', type: 'text' },
        { id: 'noHp', label: 'NOMOR HP / WHATSAPP', placeholder: 'Contoh: 081234567890', type: 'text' },
        { id: 'jalanBlok', label: 'JALAN / BLOK BIDANG', placeholder: 'Alamat letak tanah', type: 'text' },
        { id: 'rt', label: 'RT', placeholder: 'RT Letak Tanah', type: 'text' },
        { id: 'rw', label: 'RW', placeholder: 'RW Letak Tanah', type: 'text' },
        { id: 'luasM2', label: 'LUAS TANAH (M²)', placeholder: 'Contoh: 250', type: 'number' },
        { id: 'penggunaanTanah', label: 'PENGGUNAAN TANAH', placeholder: 'Contoh: Perumahan / Pertanian', type: 'text' },
        { id: 'batasUtara', label: 'BATAS UTARA', placeholder: 'Nama pemilik tanah sebelah utara', type: 'text' },
        { id: 'batasTimur', label: 'BATAS TIMUR', placeholder: 'Nama pemilik tanah sebelah timur', type: 'text' },
        { id: 'batasSelatan', label: 'BATAS SELATAN', placeholder: 'Nama pemilik tanah sebelah selatan', type: 'text' },
        { id: 'batasBarat', label: 'BATAS BARAT', placeholder: 'Nama pemilik tanah sebelah barat', type: 'text' },
      ]
    },
    2: {
      title: 'Bagian 2: Riwayat Kepemilikan & Dokumen Alas Hak (Kolom 26 - 62)',
      description: 'Isi rentetan riwayat penguasaan fisik tanah serta dokumen legalitas pendukung (AJB, Hibah, Wakaf).',
      fields: [
        { id: 'tahunPenguasaan', label: 'TAHUN PENGUASAAN OLEH PEMOHON', placeholder: 'Contoh: 2015', type: 'text' },
        { id: 'namaPemilikTerakhir', label: 'NAMA PEMILIK TERAKHIR SEBELUM PEMOHON', placeholder: 'Contoh: Ahmad Subardjo', type: 'text' },
        { id: 'berdasarkan', label: 'BERDASARKAN APA', placeholder: 'Contoh: Waris/Jual Beli', type: 'text' },
        { id: 'tahun1', label: 'TAHUN AWAL KEPEMILIKAN', placeholder: 'Contoh: 1980', type: 'text' },
        { id: 'namaPemilikAwal', label: 'NAMA PEMILIK AWAL', placeholder: 'Pemilik paling pertama', type: 'text' },
        { id: 'kohir', label: 'NOMOR KOHIR', placeholder: 'Nomor Kohir/C-Desa', type: 'text' },
        { id: 'tahun2', label: 'TAHUN KEPEMILIKAN 2', type: 'text' },
        { id: 'namaPemilik2', label: 'NAMA PEMILIK KEDUA', type: 'text' },
        { id: 'berdasarkan2', label: 'BERDASARKAN KEPEMILIKAN 2', type: 'text' },
        { id: 'tahun3', label: 'TAHUN KEPEMILIKAN 3', type: 'text' },
        { id: 'namaPemilik3', label: 'NAMA PEMILIK KETIGA', type: 'text' },
        { id: 'berdasarkan3', label: 'BERDASARKAN KEPEMILIKAN 3', type: 'text' },
        { id: 'tahun4', label: 'TAHUN KEPEMILIKAN 4', type: 'text' },
        { id: 'namaPemilik4', label: 'NAMA PEMILIK KEEMPAT', type: 'text' },
        { id: 'berdasarkan4', label: 'BERDASARKAN KEPEMILIKAN 4', type: 'text' },
        { id: 'tahun5', label: 'TAHUN KEPEMILIKAN 5', type: 'text' },
        { id: 'namaPemilik5', label: 'NAMA PEMILIK KELIMA', type: 'text' },
        { id: 'berdasarkan5', label: 'BERDASARKAN KEPEMILIKAN 5', type: 'text' },
        { id: 'helper', label: 'KOLOM HELPER', placeholder: 'Keterangan tambahan', type: 'text' },
        { id: 'noAjb', label: 'NOMOR AKTA JUAL BELI (AJB)', placeholder: 'Nomor AJB', type: 'text' },
        { id: 'tglAjb', label: 'TANGGAL AJB', type: 'date' },
        { id: 'tahunAjb', label: 'TAHUN AJB', type: 'text' },
        { id: 'ppatAjb', label: 'NAMA PPAT AJB', placeholder: 'Contoh: Notaris Hermawan SH', type: 'text' },
        { id: 'namaPewaris', label: 'NAMA PEWARIS TANAH', placeholder: 'Bila diperoleh dari warisan', type: 'text' },
        { id: 'tahunMeninggal', label: 'TAHUN MENINGGAL PEWARIS', type: 'text' },
        { id: 'noAktaHibah', label: 'NOMOR AKTA HIBAH', type: 'text' },
        { id: 'tglAktaHibah', label: 'TANGGAL AKTA HIBAH', type: 'date' },
        { id: 'tahunHibah', label: 'TAHUN HIBAH', type: 'text' },
        { id: 'ppatHibah', label: 'PPAT HIBAH', type: 'text' },
        { id: 'noAktaIkrarWakaf', label: 'NOMOR AKTA IKRAR WAKAF', type: 'text' },
        { id: 'tglWakaf', label: 'TANGGAL WAKAF', type: 'date' },
        { id: 'nadzirKetua', label: 'NADZIR KETUA', type: 'text' },
        { id: 'njop', label: 'NILAI JUAL OBJEK PAJAK (NJOP)', type: 'text' },
        { id: 'nop', label: 'NOMOR OBJEK PAJAK (NOP)', type: 'text' },
        { id: 'nib', label: 'NOMOR IDENTIFIKASI BIDANG (NIB)', placeholder: 'NIB 13 Digit', type: 'text' },
        { id: 'persil', label: 'NOMOR PERSIL', type: 'text' },
        { id: 'kepalaDesa', label: 'NAMA KEPALA DESA / LURAH', placeholder: 'Contoh: H. Mulyadi', type: 'text' },
      ]
    },
    3: {
      title: 'Bagian 3: Saksi-Saksi & Validasi Formulir (Kolom 63 - 70)',
      description: 'Lengkapi rincian data diri dua orang saksi yang mengetahui sejarah dan kepemilikan bidang tanah.',
      fields: [
        { id: 'namaSaksi1', label: 'NAMA SAKSI 1', placeholder: 'Nama Saksi Pertama', type: 'text' },
        { id: 'nikSaksi1', label: 'NIK SAKSI 1', placeholder: 'KTP Saksi Pertama', type: 'text' },
        { id: 'agamaSaksi1', label: 'AGAMA SAKSI 1', placeholder: 'Agama Saksi Pertama', type: 'text' },
        { id: 'usiaSaksi1', label: 'USIA SAKSI 1', type: 'number' },
        { id: 'pekerjaanSaksi1', label: 'PEKERJAAN SAKSI 1', type: 'text' },
        { id: 'alamatSaksi1', label: 'ALAMAT SAKSI 1', type: 'text' },
        { id: 'namaSaksi2', label: 'NAMA SAKSI 2', placeholder: 'Nama Saksi Kedua', type: 'text' },
        { id: 'nikSaksi2', label: 'NIK SAKSI 2', placeholder: 'KTP Saksi Kedua', type: 'text' },
        { id: 'agamaSaksi2', label: 'AGAMA SAKSI 2', placeholder: 'Agama Saksi Kedua', type: 'text' },
        { id: 'usiaSaksi2', label: 'USIA SAKSI 2', type: 'number' },
        { id: 'pekerjaanSaksi2', label: 'PEKERJAAN SAKSI 2', type: 'text' },
        { id: 'alamatSaksi2', label: 'ALAMAT SAKSI 2', type: 'text' },
      ]
    }
  };

  const handleInputChange = (field: keyof ApplicantData, value: string) => {
    updateDraftField(field, value);
    
    if (field === 'no') {
      const matched = findMatchingAsset(value);
      if (matched) {
        setSelectedAssetId(matched.id.toString());
        const computedArea = matched.type === 'Polygon' ? calculatePolygonArea(matched.coordinates) : 0;
        const updates: Partial<ApplicantData> = {};
        if (computedArea > 0 && !draft.luasM2) {
          updates.luasM2 = computedArea.toString();
        }
        if (!draft.nib) {
          updates.nib = matched.name;
        }
        if (!draft.persil) {
          updates.persil = matched.name;
        }
        if (Object.keys(updates).length > 0) {
          updateMultipleDraftFields(updates);
        }
      }
    }
  };

  const handleClear = () => {
    if (confirm('Apakah Anda yakin ingin menghapus seluruh draf formulir pemohon ini?')) {
      clearDraft();
      setSelectedAssetId('');
      setUseGpsForNewAsset(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!draft.namaPemohon) {
      alert('Nama Pemohon wajib diisi sebelum menyimpan data.');
      return;
    }

    setIsSubmitting(true);

    try {
      let targetAsset: Asset | null = null;

      // 1. If linking to an existing KML/Map Asset
      if (selectedAssetId) {
        const found = assets.find(a => a.id.toString() === selectedAssetId);
        if (found) targetAsset = found;
      }

      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (userToken) {
        headers['Authorization'] = `Bearer ${userToken}`;
      }

      if (targetAsset) {
        // Embed the 70 applicant columns inside the properties.applicantData of the asset
        const updatedProperties = {
          ...(targetAsset.properties || {}),
          applicantData: draft,
          hasApplicant: true,
          color: '#10B981', // green highlights when applicant is registered
        };

        const res = await fetch(`/api/assets/${targetAsset.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            name: `${draft.namaPemohon} - (PTSL: ${draft.tahunPtsl || 'N/A'})`,
            description: `Pemohon: ${draft.namaPemohon}, NIK: ${draft.nik}, Luas: ${draft.luasM2 || 'N/A'} m2. Batas Utara: ${draft.batasUtara || '-'}`,
            type: targetAsset.type,
            coordinates: targetAsset.coordinates,
            properties: updatedProperties
          })
        });

        if (res.ok) {
          alert(`✓ DATA VALID: Sukses mengintegrasikan data Pemohon "${draft.namaPemohon}" ke Aset KML "${targetAsset.name}"!`);
          clearDraft();
          setSelectedAssetId('');
          onRefreshAssets();
          onNavigateToMap();
        } else {
          const err = await res.json();
          alert(`Gagal menyimpan: ${err.error || 'Server error'}`);
        }
      } else {
        // 2. No target asset, create a new point using GPS or default center
        let lat = -6.2088;
        let lng = 106.8456;

        if (useGpsForNewAsset && navigator.geolocation) {
          await new Promise<void>((resolve) => {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                lat = pos.coords.latitude;
                lng = pos.coords.longitude;
                resolve();
              },
              () => {
                alert('Tidak dapat mendeteksi GPS. Menggunakan lokasi default Jakarta.');
                resolve();
              }
            );
          });
        }

        const newAssetBody = {
          name: `${draft.namaPemohon} - Register: ${draft.noRegister || 'N/A'}`,
          description: `Pemohon: ${draft.namaPemohon}, NIK: ${draft.nik}, Luas: ${draft.luasM2 || 'N/A'} m2. Desa: ${draft.desa}`,
          type: 'Point',
          coordinates: { lat, lng },
          properties: {
            color: '#10B981',
            applicantData: draft,
            hasApplicant: true
          }
        };

        const res = await fetch('/api/assets', {
          method: 'POST',
          headers,
          body: JSON.stringify(newAssetBody)
        });

        if (res.ok) {
          alert(`✓ DATA VALID: Sukses membuat Aset Point baru dan mendaftarkan data Pemohon "${draft.namaPemohon}"!`);
          clearDraft();
          onRefreshAssets();
          onNavigateToMap();
        } else {
          const err = await res.json();
          alert(`Gagal membuat aset baru: ${err.error || 'Server error'}`);
        }
      }
    } catch (err: any) {
      console.error('Error submitting form:', err);
      alert('Terjadi kesalahan: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6 flex flex-col gap-6" id="applicant_form_page">
      
      {/* Page header and summary banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
        <div className="flex items-start gap-3.5">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 flex-shrink-0">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2">
              Input Data Pemohon PTSL
              <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                70 Kolom Terintegrasi KML
              </span>
            </h2>
            <p className="text-slate-500 text-xs mt-0.5 max-w-xl leading-relaxed">
              Formulir digital komprehensif untuk pengumpulan data peserta PTSL. Seluruh entri draf disimpan otomatis di komputer Anda secara lokal agar aman sebelum disubmit.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleClear}
            className="px-3.5 py-2 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Hapus Draf
          </button>
          <button
            type="button"
            onClick={saveDraftToStorage}
            className="px-3.5 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            Simpan ke Draf
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left column: Wizard Navigation & Integration Settings */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Form step navigation */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tahapan Formulir</h3>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className={`w-full p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
                  currentStep === 1 
                    ? 'border-indigo-500 bg-indigo-50/50 text-indigo-900 ring-1 ring-indigo-500' 
                    : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-bold ${
                  currentStep === 1 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  1
                </div>
                <div>
                  <h4 className="text-xs font-bold">Identitas & Bidang Tanah</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">Identitas pemohon & batas tanah</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className={`w-full p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
                  currentStep === 2 
                    ? 'border-indigo-500 bg-indigo-50/50 text-indigo-900 ring-1 ring-indigo-500' 
                    : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-bold ${
                  currentStep === 2 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  2
                </div>
                <div>
                  <h4 className="text-xs font-bold">Riwayat & Dokumen Alas Hak</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">AJB, warisan, hibah, wakaf, dll.</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className={`w-full p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
                  currentStep === 3 
                    ? 'border-indigo-500 bg-indigo-50/50 text-indigo-900 ring-1 ring-indigo-500' 
                    : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-bold ${
                  currentStep === 3 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  3
                </div>
                <div>
                  <h4 className="text-xs font-bold">Data Saksi-Saksi</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">Rincian biodata saksi PTSL</p>
                </div>
              </button>
            </div>
          </div>

          {/* Integration: Link to KML / Map Asset */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Link className="w-3.5 h-3.5 text-emerald-500" /> Integrasi Geometris (KML)
            </h3>
            
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Hubungkan formulir 70 kolom ini ke salah satu objek bidang tanah dari KML yang telah Anda unggah atau buat secara manual.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Cari Nama / Nomor Aset KML
                </label>
                <input
                  type="text"
                  placeholder="Ketik nomor aset, nama, atau NIB..."
                  value={assetSearchTerm}
                  onChange={(e) => setAssetSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all font-semibold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">
                  Pilih Aset Geometris Terkait {assetSearchTerm && `(${filteredAssets.length} ditemukan)`}
                </label>
                <select
                  value={selectedAssetId}
                  onChange={(e) => {
                    setSelectedAssetId(e.target.value);
                    if (e.target.value) {
                      setUseGpsForNewAsset(false);
                    }
                  }}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all font-bold"
                >
                  <option value="">-- Buat Objek Geometris Baru --</option>
                  {filteredAssets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      [{asset.type}] {asset.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedAssetId && (
                (() => {
                  const selectedAsset = assets.find(a => a.id.toString() === selectedAssetId);
                  if (!selectedAsset) return null;
                  const computedArea = selectedAsset.type === 'Polygon' ? calculatePolygonArea(selectedAsset.coordinates) : 0;
                  
                  return (
                    <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 space-y-3 text-slate-700">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded uppercase tracking-wider">
                          KML Terpilih: {selectedAsset.type}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            onNavigateToMap();
                          }}
                          className="text-[10px] text-indigo-600 hover:underline font-bold"
                        >
                          Lihat di Peta
                        </button>
                      </div>

                      <div className="text-xs">
                        <span className="text-slate-400 block text-[9px] font-bold">NAMA / NOMOR BANYAK KML:</span>
                        <span className="text-slate-800 font-bold font-mono">{selectedAsset.name}</span>
                      </div>

                      {computedArea > 0 && (
                        <div className="text-xs">
                          <span className="text-slate-400 block text-[9px] font-bold">LUAS BIDANG KML:</span>
                          <span className="text-emerald-700 font-extrabold">{computedArea} m²</span>
                        </div>
                      )}

                      <div className="pt-2 border-t border-emerald-100 space-y-1.5">
                        <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                          Salin Otomatis ke Form:
                        </span>
                        
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              updateDraftField('nib', selectedAsset.name);
                              alert(`Berhasil menyalin "${selectedAsset.name}" ke kolom NIB!`);
                            }}
                            className="px-2 py-1 bg-white hover:bg-emerald-100 border border-emerald-200 rounded text-[9px] font-bold text-slate-700 transition-all cursor-pointer shadow-sm"
                          >
                            Isi NIB
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              updateDraftField('noRegister', selectedAsset.name);
                              alert(`Berhasil menyalin "${selectedAsset.name}" ke kolom No Register!`);
                            }}
                            className="px-2 py-1 bg-white hover:bg-emerald-100 border border-emerald-200 rounded text-[9px] font-bold text-slate-700 transition-all cursor-pointer shadow-sm"
                          >
                            Isi No Reg
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              updateDraftField('persil', selectedAsset.name);
                              alert(`Berhasil menyalin "${selectedAsset.name}" ke kolom Persil!`);
                            }}
                            className="px-2 py-1 bg-white hover:bg-emerald-100 border border-emerald-200 rounded text-[9px] font-bold text-slate-700 transition-all cursor-pointer shadow-sm"
                          >
                            Isi Persil
                          </button>

                          {computedArea > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                updateDraftField('luasM2', computedArea.toString());
                                alert(`Berhasil menyalin Luas "${computedArea} m²" ke kolom Luas Tanah!`);
                              }}
                              className="px-2 py-1 bg-white hover:bg-emerald-100 border border-emerald-200 rounded text-[9px] font-bold text-slate-700 transition-all cursor-pointer shadow-sm"
                            >
                              Isi Luas ({computedArea} m²)
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()
              )}

              {!selectedAssetId && (
                <div className="pt-1">
                  <label className="flex items-center gap-2 cursor-pointer bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <input
                      type="checkbox"
                      checked={useGpsForNewAsset}
                      onChange={(e) => setUseGpsForNewAsset(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 bg-white focus:ring-0 w-4 h-4 cursor-pointer"
                    />
                    <div className="flex flex-col">
                      <span className="text-[11px] text-slate-700 font-bold flex items-center gap-1">
                        <Compass className="w-3.5 h-3.5 text-indigo-500" /> 
                        Gunakan GPS Saat Ini
                      </span>
                      <span className="text-[9px] text-slate-400 mt-0.5">Dapatkan koordinat letak secara otomatis via GPS.</span>
                    </div>
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Tips / Info box */}
          <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl flex gap-3 text-xs leading-relaxed text-indigo-900 shadow-sm shadow-indigo-100/10">
            <Info className="w-5 h-5 flex-shrink-0 text-indigo-500 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-bold text-indigo-800">Tips Pengisian</h4>
              <p className="text-[11px] text-indigo-700/80">
                Gunakan tab navigasi di sebelah kanan atau klik langsung nomor tahapan untuk berpindah bagian. Kolom <b>Nama Lengkap Pemohon</b> merupakan syarat wajib untuk menyimpan data ke database.
              </p>
            </div>
          </div>

        </div>

        {/* Right column: Main dynamic Form elements */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-full">
            
            {/* Form Section Header */}
            <div className="p-5 border-b border-slate-100 bg-slate-50/50">
              <span className="text-[9px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Langkah {currentStep} dari 3
              </span>
              <h3 className="text-sm font-bold text-slate-800 mt-1.5">
                {sections[currentStep].title}
              </h3>
              <p className="text-slate-500 text-xs mt-0.5">
                {sections[currentStep].description}
              </p>
            </div>

            {/* Inputs Grid */}
            <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px]">
              {sections[currentStep].fields.map((field) => {
                const isNoField = field.id === 'no';
                const isNoRegisterField = field.id === 'noRegister';
                const matched = isNoField ? findMatchingAsset(draft.no) : null;
                const computedArea = (matched && matched.type === 'Polygon') ? calculatePolygonArea(matched.coordinates) : 0;

                return (
                  <div 
                    key={field.id} 
                    className={`space-y-1.5 ${isNoField ? 'md:col-span-2 bg-indigo-50/20 p-4 rounded-xl border border-indigo-100/60' : ''}`}
                  >
                    <label className="block text-[11px] font-bold text-slate-600 flex items-center justify-between">
                      <span>{field.label} {field.required && <span className="text-red-500">*</span>}</span>
                      {isNoRegisterField && (
                        <span className="text-[9px] font-bold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded uppercase">
                          No Urut Otomatis
                        </span>
                      )}
                    </label>
                    
                    {field.type === 'textarea' ? (
                      <textarea
                        value={draft[field.id as keyof ApplicantData] || ''}
                        onChange={(e) => handleInputChange(field.id as keyof ApplicantData, e.target.value)}
                        placeholder={field.placeholder}
                        rows={2}
                        className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all font-medium resize-none"
                      />
                    ) : (
                      <input
                        type={field.type}
                        value={draft[field.id as keyof ApplicantData] || ''}
                        onChange={(e) => handleInputChange(field.id as keyof ApplicantData, e.target.value)}
                        placeholder={field.placeholder}
                        className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all font-medium"
                      />
                    )}

                    {/* Show live integration feedback for "NO" field if matched with a KML asset */}
                    {isNoField && matched && (
                      <div className="mt-3 bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-slate-700 animate-fadeIn">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span>✓ Terintegrasi Secara Otomatis dengan KML</span>
                          </div>
                          <p className="text-[10px] text-slate-500">
                            Terhubung ke bidang <b>{matched.name}</b> ({matched.type}) {computedArea > 0 ? `dengan Luas ${computedArea} m²` : ''}.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {onSelectAssetAndGoToMap && (
                            <button
                              type="button"
                              onClick={() => {
                                onSelectAssetAndGoToMap(matched);
                              }}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-sm shadow-emerald-600/10"
                            >
                              <MapPin className="w-3.5 h-3.5" />
                              <span>Tunjukkan di Peta</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              const updates: Partial<ApplicantData> = {};
                              if (computedArea > 0) updates.luasM2 = computedArea.toString();
                              updates.nib = matched.name;
                              updates.persil = matched.name;
                              updateMultipleDraftFields(updates);
                              alert('Berhasil mengisi Luas, NIB, dan Persil dari data KML!');
                            }}
                            className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-[10px] font-bold transition-all cursor-pointer shadow-sm"
                          >
                            Salin Info KML
                          </button>
                        </div>
                      </div>
                    )}
                    {isNoField && !matched && draft.no.trim() && (
                      <div className="mt-2 bg-amber-50 border border-amber-200 p-3 rounded-xl text-[10px] text-amber-800">
                        Belum terintegrasi dengan KML mana pun. Masukkan No yang sama dengan nama/nomor bidang KML Anda, atau pilih manual di menu sebelah kiri.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Form actions (Next, Back, Submit) */}
            <div className="p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <div>
                {currentStep > 1 && (
                  <button
                    type="button"
                    onClick={() => setCurrentStep((prev) => (prev - 1) as any)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-all cursor-pointer"
                  >
                    Sebelumnya
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {currentStep < 3 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentStep((prev) => (prev + 1) as any)}
                    className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-750 rounded-xl transition-all shadow-sm shadow-indigo-600/10 cursor-pointer"
                  >
                    Berikutnya
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl transition-all shadow-md shadow-emerald-600/10 flex items-center gap-1.5 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <span>Memproses...</span>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Simpan ke Database PostGIS
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

          </form>
        </div>

      </div>

    </div>
  );
};
