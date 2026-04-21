'use client'
import { useEffect, useState, useRef } from 'react'
import { deriveTheme, getVerticalVoice } from '@/lib/theme'

interface Message { role: 'user' | 'assistant'; content: string; streaming?: boolean }
interface RecData {
  format: 'single' | 'flight'
  recommendationName: string
  tagline: string
  selectedProducts: Array<{ name: string; why: string; price: number }>
  flightDetails: { flightName: string; price: number; pourSize: string; count: number } | null
  flavorProfile: string[]
  story: string
  whyItFitsYou: string
  serveNote: string
}

function stripRec(t: string) {
  return t.replace(/===REC===[\s\S]*?===END===/g, '').trim()
}

function getMoodChips(vertical: string): string[][] {
  const chips: Record<string, string[][]> = {
    brewery: [
      ['Crisp & Light', 'Bold & Dark', 'Hoppy & Bright', 'Surprise Me'],
      ['First time here', 'I know what I like', 'Let me explore', 'Just something cold'],
    ],
    winery: [
      ['Fruity & Sweet', 'Dry & Bold', 'Light & Crisp', 'Surprise Me'],
      ['Celebrating tonight', 'Just relaxing', 'New to wine', 'Regular here'],
    ],
    distillery: [
      ['Neat & Sipping', 'Cocktail please', 'Bold & Smoky', 'Surprise Me'],
      ['First time here', 'I know spirits', 'Show me your best', 'Something unique'],
    ],
    coffee: [
      ['Light & Bright', 'Dark & Rich', 'Sweet & Smooth', 'Surprise Me'],
      ['Morning fuel', 'Afternoon treat', 'New to specialty', 'I love espresso'],
    ],
  }
  return chips[vertical] || chips.brewery
}

export default function CustomerPage({ params }: { params: { slug: string } }) {
  const [retailer, setRetailer] = useState<any>(null)
  const [products, setProducts] = useState<any[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [streaming, setStreaming] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [rec, setRec] = useState<RecData | null>(null)
  const [ordered, setOrdered] = useState(false)
  const [screen, setScreen] = useState<'welcome' | 'chips' | 'chat' | 'rec' | 'order'>('welcome')
  const [selectedChips, setSelectedChips] = useState<string[]>([])
  const [chipStep, setChipStep] = useState(0)
  const [guestEmail, setGuestEmail] = useState('')
  const [emailSaved, setEmailSaved] = useState(false)
  const msgListRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
