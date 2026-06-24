import React, { createContext, useContext, useState, useEffect } from 'react';

export interface ApplicantData {
  // Part 1: Identitas Pemohon & Bidang Tanah (1 - 25)
  no: string;
  noRegister: string;
  tglWarkah: string;
  desa: string;
  tahunPtsl: string;
  timPtsl: string;
  namaPuldadisDesa: string;
  namaPemohon: string;
  nik: string;
  tempatLahir: string;
  tglLahir: string;
  usia: string;
  agama: string;
  pekerjaan: string;
  alamatPemohon: string;
  noHp: string;
  jalanBlok: string;
  rt: string;
  rw: string;
  luasM2: string;
  penggunaanTanah: string;
  batasUtara: string;
  batasTimur: string;
  batasSelatan: string;
  batasBarat: string;

  // Part 2: Riwayat Kepemilikan & Dokumen Alas Hak (26 - 62)
  tahunPenguasaan: string;
  namaPemilikTerakhir: string;
  berdasarkan: string;
  tahun1: string;
  namaPemilikAwal: string;
  kohir: string;
  tahun2: string;
  namaPemilik2: string;
  berdasarkan2: string;
  tahun3: string;
  namaPemilik3: string;
  berdasarkan3: string;
  tahun4: string;
  namaPemilik4: string;
  berdasarkan4: string;
  tahun5: string;
  namaPemilik5: string;
  berdasarkan5: string;
  helper: string;
  noAjb: string;
  tglAjb: string;
  tahunAjb: string;
  ppatAjb: string;
  namaPewaris: string;
  tahunMeninggal: string;
  noAktaHibah: string;
  tglAktaHibah: string;
  tahunHibah: string;
  ppatHibah: string;
  noAktaIkrarWakaf: string;
  tglWakaf: string;
  nadzirKetua: string;
  njop: string;
  nop: string;
  nib: string;
  persil: string;
  kepalaDesa: string;

  // Part 3: Saksi-saksi (63 - 74)
  namaSaksi1: string;
  nikSaksi1: string;
  agamaSaksi1: string;
  usiaSaksi1: string;
  pekerjaanSaksi1: string;
  alamatSaksi1: string;
  namaSaksi2: string;
  nikSaksi2: string;
  agamaSaksi2: string;
  usiaSaksi2: string;
  pekerjaanSaksi2: string;
  alamatSaksi2: string;
}

const initialApplicantState: ApplicantData = {
  no: '',
  noRegister: '',
  tglWarkah: '',
  desa: '',
  tahunPtsl: '',
  timPtsl: '',
  namaPuldadisDesa: '',
  namaPemohon: '',
  nik: '',
  tempatLahir: '',
  tglLahir: '',
  usia: '',
  agama: '',
  pekerjaan: '',
  alamatPemohon: '',
  noHp: '',
  jalanBlok: '',
  rt: '',
  rw: '',
  luasM2: '',
  penggunaanTanah: '',
  batasUtara: '',
  batasTimur: '',
  batasSelatan: '',
  batasBarat: '',

  tahunPenguasaan: '',
  namaPemilikTerakhir: '',
  berdasarkan: '',
  tahun1: '',
  namaPemilikAwal: '',
  kohir: '',
  tahun2: '',
  namaPemilik2: '',
  berdasarkan2: '',
  tahun3: '',
  namaPemilik3: '',
  berdasarkan3: '',
  tahun4: '',
  namaPemilik4: '',
  berdasarkan4: '',
  tahun5: '',
  namaPemilik5: '',
  berdasarkan5: '',
  helper: '',
  noAjb: '',
  tglAjb: '',
  tahunAjb: '',
  ppatAjb: '',
  namaPewaris: '',
  tahunMeninggal: '',
  noAktaHibah: '',
  tglAktaHibah: '',
  tahunHibah: '',
  ppatHibah: '',
  noAktaIkrarWakaf: '',
  tglWakaf: '',
  nadzirKetua: '',
  njop: '',
  nop: '',
  nib: '',
  persil: '',
  kepalaDesa: '',

  namaSaksi1: '',
  nikSaksi1: '',
  agamaSaksi1: '',
  usiaSaksi1: '',
  pekerjaanSaksi1: '',
  alamatSaksi1: '',
  namaSaksi2: '',
  nikSaksi2: '',
  agamaSaksi2: '',
  usiaSaksi2: '',
  pekerjaanSaksi2: '',
  alamatSaksi2: '',
};

interface ApplicantContextType {
  draft: ApplicantData;
  updateDraftField: (field: keyof ApplicantData, value: string) => void;
  updateMultipleDraftFields: (fields: Partial<ApplicantData>) => void;
  clearDraft: () => void;
  saveDraftToStorage: () => void;
  isDraftEmpty: boolean;
}

const ApplicantContext = createContext<ApplicantContextType | undefined>(undefined);

export const ApplicantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [draft, setDraft] = useState<ApplicantData>(() => {
    try {
      const stored = localStorage.getItem('pemohon_draft');
      return stored ? JSON.parse(stored) : initialApplicantState;
    } catch (e) {
      console.error('Error reading draft from localStorage:', e);
      return initialApplicantState;
    }
  });

  // Sync draft to localStorage automatically on changes
  useEffect(() => {
    localStorage.setItem('pemohon_draft', JSON.stringify(draft));
  }, [draft]);

  const updateDraftField = (field: keyof ApplicantData, value: string) => {
    setDraft((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const updateMultipleDraftFields = (fields: Partial<ApplicantData>) => {
    setDraft((prev) => ({
      ...prev,
      ...fields,
    }));
  };

  const clearDraft = () => {
    setDraft(initialApplicantState);
    localStorage.removeItem('pemohon_draft');
  };

  const saveDraftToStorage = () => {
    localStorage.setItem('pemohon_draft', JSON.stringify(draft));
  };

  const isDraftEmpty = Object.values(draft).every((v) => v === '');

  return (
    <ApplicantContext.Provider
      value={{
        draft,
        updateDraftField,
        updateMultipleDraftFields,
        clearDraft,
        saveDraftToStorage,
        isDraftEmpty,
      }}
    >
      {children}
    </ApplicantContext.Provider>
  );
};

export const useApplicant = () => {
  const context = useContext(ApplicantContext);
  if (!context) {
    throw new Error('useApplicant must be used within an ApplicantProvider');
  }
  return context;
};
