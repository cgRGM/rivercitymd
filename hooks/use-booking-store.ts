import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'



interface Vehicle {
  year: string
  make: string
  model: string
  color?: string
  licensePlate?: string
  size?: "small" | "medium" | "large"
  type?: string // Optional type on individual vehicle if needed, but step3Data has global vehicleType
}

interface Step1Data {
  scheduledDate: Date // stored as string in JSON, revived as string usually unless custom revive
  scheduledTime: string
  street: string
  city: string
  state: string
  zip?: string
  locationNotes?: string
}

interface Step2Data {
  name: string
  phone: string
  email: string
}

interface Step3Data {
  vehicleType?: "car" | "truck" | "suv"
  vehicles: Vehicle[]
}

interface Step4Data {
  serviceIds: string[]
}

interface BookingStore {
  currentStep: number
  step1Data: Step1Data | null
  step2Data: Step2Data | null
  step3Data: Step3Data | null
  step4Data: Step4Data | null
  
  // Actions
  setCurrentStep: (step: number) => void
  setStep1Data: (data: Step1Data) => void
  setStep2Data: (data: Step2Data) => void
  setStep3Data: (data: Step3Data) => void
  setStep4Data: (data: Step4Data) => void
  resetBooking: () => void
}

export const useBookingStore = create<BookingStore>()(
  persist(
    (set) => ({
      currentStep: 1,
      step1Data: null,
      step2Data: null,
      step3Data: null,
      step4Data: null,

      setCurrentStep: (step) => set({ currentStep: step }),
      setStep1Data: (data) => set({ step1Data: data }),
      setStep2Data: (data) => set({ step2Data: data }),
      setStep3Data: (data) => set({ step3Data: data }),
      setStep4Data: (data) => set({ step4Data: data }),
      resetBooking: () => set({
        currentStep: 1,
        step1Data: null,
        step2Data: null,
        step3Data: null,
        step4Data: null
      })
    }),
    {
      name: 'booking-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Don't persist sensitive UI state if we add any, but persist data
        currentStep: state.currentStep,
        step1Data: state.step1Data,
        step2Data: state.step2Data,
        step3Data: state.step3Data,
        step4Data: state.step4Data
      })
    }
  )
)
