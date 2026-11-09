import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import axios from 'axios';
import './App.css';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';

// Import Lucide icons
import { 
  Shield, 
  Upload, 
  Download, 
  Lock, 
  Eye, 
  EyeOff, 
  User, 
  LogOut,
  Share2,
  Clock,
  FileText,
  Copy,
  CheckCircle,
  AlertTriangle,
  Key,
  Database,
  QrCode,
  Image as ImageIcon,
  FileImage,
  X,
  ZoomIn,
  RotateCcw,
  RotateCw,
  ZoomOut,
  BarChart3,
  TrendingUp,
  Users,
  HardDrive,
  Activity,
  Phone,
  Smartphone,
  Settings,
  LineChart,
  PieChart,
  Calendar,
  ArrowUp,
  ArrowDown
} from 'lucide-react';

// Import UI components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const BACKEND_URL = (process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000').replace(/\/+$/, '');
const API = `${BACKEND_URL}/api`;

// QR Code Generator Utility
const generateQRCode = (text, size = 200) => {
  const qrServer = 'https://api.qrserver.com/v1/create-qr-code/';
  return `${qrServer}?size=${size}x${size}&data=${encodeURIComponent(text)}`;
};

// File Preview Utilities
const FilePreviewUtils = {
  isPreviewable(filename, mimeType = '') {
    const ext = filename.toLowerCase().split('.').pop();
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
    const textExts = ['txt', 'md', 'json', 'xml', 'csv'];
    const pdfExts = ['pdf'];
    const officeExts = ['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'];
    
    return imageExts.includes(ext) || textExts.includes(ext) || pdfExts.includes(ext) || officeExts.includes(ext);
  },
  
  getPreviewType(filename) {
    const ext = filename.toLowerCase().split('.').pop();
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
    const textExts = ['txt', 'md', 'json', 'xml', 'csv'];
    const officeExts = ['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'];
    
    if (imageExts.includes(ext)) return 'image';
    if (textExts.includes(ext)) return 'text';
    if (ext === 'pdf') return 'pdf';
    if (officeExts.includes(ext)) return 'office';
    return 'unsupported';
  },
  
  async generatePreview(file) {
    const type = this.getPreviewType(file.name);
    
    if (type === 'image') {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve({
          type: 'image',
          data: e.target.result,
          filename: file.name
        });
        reader.readAsDataURL(file);
      });
    }
    
    if (type === 'text') {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve({
          type: 'text',
          data: e.target.result,
          filename: file.name
        });
        reader.readAsText(file);
      });
    }
    
    if (type === 'pdf') {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve({
          type: 'pdf',
          data: e.target.result,
          filename: file.name
        });
        reader.readAsDataURL(file);
      });
    }
    
    if (type === 'office') {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve({
          type: 'office',
          data: e.target.result,
          filename: file.name,
          extension: file.name.toLowerCase().split('.').pop()
        });
        reader.readAsDataURL(file);
      });
    }
    
    return { type: 'unsupported', filename: file.name };
  }
};

// Utility Functions
const formatBytes = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatNumber = (num) => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
};

// Crypto utility functions
const CryptoUtils = {
  async generateAESKey() {
    return await window.crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  },

  async exportKey(key) {
    return await window.crypto.subtle.exportKey('raw', key);
  },

  async importKey(keyBuffer) {
    return await window.crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'AES-GCM' },
      true,
      ['encrypt', 'decrypt']
    );
  },

  async deriveKeyFromPassword(password, salt) {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);
    
    const baseKey = await window.crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    return await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  },

  async encryptFile(file, password) {
    // Generate AES key
    const aesKey = await this.generateAESKey();
    
    // Generate IV and salt
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    
    // Read file as array buffer
    const fileBuffer = await file.arrayBuffer();
    
    // Encrypt file with AES key
    const encryptedFile = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      aesKey,
      fileBuffer
    );
    
    // Derive key from password to encrypt the AES key
    const passwordDerivedKey = await this.deriveKeyFromPassword(password, salt);
    const aesKeyBuffer = await this.exportKey(aesKey);
    
    // Encrypt the AES key with password-derived key
    const keyIv = window.crypto.getRandomValues(new Uint8Array(12));
    const encryptedAESKey = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: keyIv },
      passwordDerivedKey,
      aesKeyBuffer
    );
    
    // Create encrypted key blob
    const encryptedKeyBlob = JSON.stringify({
      encryptedKey: Array.from(new Uint8Array(encryptedAESKey)),
      salt: Array.from(salt),
      keyIv: Array.from(keyIv)
    });
    
    // Combine IV and encrypted file
    const result = new Uint8Array(iv.length + encryptedFile.byteLength);
    result.set(iv, 0);
    result.set(new Uint8Array(encryptedFile), iv.length);
    
    return {
      encryptedFile: result,
      encryptedKeyBlob
    };
  },

  async decryptFile(encryptedFileBuffer, encryptedKeyBlob, password) {
    try {
      const keyData = JSON.parse(encryptedKeyBlob);
      
      // Extract salt and derive key from password
      const salt = new Uint8Array(keyData.salt);
      const passwordDerivedKey = await this.deriveKeyFromPassword(password, salt);
      
      // Decrypt the AES key
      const encryptedAESKey = new Uint8Array(keyData.encryptedKey);
      const keyIv = new Uint8Array(keyData.keyIv);
      
      const decryptedAESKey = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: keyIv },
        passwordDerivedKey,
        encryptedAESKey
      );
      
      // Import the AES key
      const aesKey = await this.importKey(decryptedAESKey);
      
      // Extract IV and encrypted file
      const iv = encryptedFileBuffer.slice(0, 12);
      const encryptedFile = encryptedFileBuffer.slice(12);
      
      // Decrypt the file
      const decryptedFile = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        aesKey,
        encryptedFile
      );
      
      return decryptedFile;
    } catch (error) {
      throw new Error('Failed to decrypt file. Invalid password or corrupted data.');
    }
  }
};

// File Preview Component
const FilePreview = ({ preview, onClose }) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  if (!preview) return null;

  const handleZoom = (direction) => {
    setZoom(prev => {
      const newZoom = direction === 'in' ? prev * 1.2 : prev / 1.2;
      return Math.max(0.1, Math.min(3, newZoom));
    });
  };

  const handleRotation = (direction) => {
    setRotation(prev => (prev + (direction === 'cw' ? 90 : -90)) % 360);
  };

  return (
    <Dialog open={!!preview} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center justify-between">
            <div className="flex items-center">
              <FileImage className="h-5 w-5 mr-2 text-emerald-400" />
              File Preview: {preview.filename}
            </div>
            <div className="flex items-center space-x-2">
              {preview.type === 'image' && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleZoom('out')}
                    className="border-slate-600 text-slate-300"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleZoom('in')}
                    className="border-slate-600 text-slate-300"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRotation('ccw')}
                    className="border-slate-600 text-slate-300"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRotation('cw')}
                    className="border-slate-600 text-slate-300"
                  >
                    <RotateCw className="h-4 w-4" />
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                className="border-slate-600 text-slate-300"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto bg-slate-800 rounded-lg p-4">
          {preview.type === 'image' && (
            <div className="flex justify-center">
              <img
                src={preview.data}
                alt={preview.filename}
                className="max-w-full max-h-full object-contain"
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  transition: 'transform 0.2s ease'
                }}
              />
            </div>
          )}
          
          {preview.type === 'text' && (
            <pre className="text-slate-300 text-sm whitespace-pre-wrap font-mono overflow-auto">
              {preview.data}
            </pre>
          )}
          
          {preview.type === 'pdf' && (
            <div className="w-full h-full">
              <iframe
                src={preview.data}
                className="w-full h-96 border border-slate-600 rounded"
                title={`PDF Preview: ${preview.filename}`}
              />
              <div className="mt-4 text-center">
                <p className="text-slate-400 text-sm">
                  PDF Preview: {preview.filename}
                </p>
                <p className="text-slate-500 text-xs mt-1">
                  Some browsers may not support inline PDF preview. The file will work normally when downloaded.
                </p>
              </div>
            </div>
          )}
          
          {preview.type === 'office' && (
            <div className="text-center py-8">
              <div className="mb-4">
                {preview.extension === 'doc' || preview.extension === 'docx' ? (
                  <FileText className="h-16 w-16 mx-auto mb-4 text-blue-400" />
                ) : preview.extension === 'ppt' || preview.extension === 'pptx' ? (
                  <FileImage className="h-16 w-16 mx-auto mb-4 text-orange-400" />
                ) : (
                  <FileText className="h-16 w-16 mx-auto mb-4 text-green-400" />
                )}
              </div>
              
              <h3 className="text-white font-medium mb-2">{preview.filename}</h3>
              <p className="text-slate-400 mb-4">
                Office Document Preview
              </p>
              
              <div className="space-y-3">
                <p className="text-slate-500 text-sm">
                  Office documents require download for full viewing. Available preview options:
                </p>
                
                <div className="flex flex-col sm:flex-row gap-2 justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const officeViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(preview.data)}`;
                      window.open(officeViewerUrl, '_blank');
                    }}
                    className="border-slate-600 text-slate-300"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Open in Office Viewer
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const googleDocsUrl = `https://docs.google.com/gview?url=${encodeURIComponent(preview.data)}&embedded=true`;
                      window.open(googleDocsUrl, '_blank');
                    }}
                    className="border-slate-600 text-slate-300"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Open in Google Docs Viewer
                  </Button>
                </div>
                
                <p className="text-slate-500 text-xs">
                  Note: Online viewers work best with files from public URLs. Downloaded files will work normally.
                </p>
              </div>
            </div>
          )}
          
          {preview.type === 'unsupported' && (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto mb-4 text-slate-500" />
              <p className="text-slate-400">Preview not available for this file type</p>
              <p className="text-slate-500 text-sm mt-2">{preview.filename}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// QR Code Modal Component
const QRCodeModal = ({ shareUrl, isOpen, onClose }) => {
  const qrCodeUrl = shareUrl ? generateQRCode(shareUrl, 256) : null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center">
            <QrCode className="h-5 w-5 mr-2 text-emerald-400" />
            QR Code for File Sharing
          </DialogTitle>
        </DialogHeader>
        <div className="text-center space-y-4">
          {qrCodeUrl && (
            <>
              <div className="bg-white p-4 rounded-lg inline-block">
                <img src={qrCodeUrl} alt="QR Code" className="w-64 h-64" />
              </div>
              <p className="text-slate-400 text-sm">
                Scan this QR code to access the secure file
              </p>
              <div className="bg-slate-800 p-3 rounded border border-slate-600">
                <p className="text-slate-300 text-xs break-all">{shareUrl}</p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// 2FA Setup Modal Component
const TwoFAModal = ({ isOpen, onClose, onSuccess }) => {
  const [step, setStep] = useState('choose'); // 'choose', 'setup', 'verify'
  const [method, setMethod] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleMethodSelect = async (selectedMethod) => {
    setMethod(selectedMethod);
    setLoading(true);
    
    try {
      const payload = selectedMethod === 'sms' ? 
        { method: selectedMethod, phone_number: phoneNumber } :
        { method: selectedMethod };
      
      if (selectedMethod === 'sms' && !phoneNumber) {
        setStep('phone');
        setLoading(false);
        return;
      }
      
      const response = await axios.post(`${API}/auth/2fa/setup`, payload);
      
      if (selectedMethod === 'app') {
        setQrCode(response.data.qr_code);
        setSecret(response.data.secret);
      }
      
      setStep('verify');
      toast.success(response.data.message);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to setup 2FA');
    }
    
    setLoading(false);
  };

  const handlePhoneSubmit = async () => {
    if (!phoneNumber) {
      toast.error('Please enter a phone number');
      return;
    }
    await handleMethodSelect('sms');
  };

  const handleVerification = async () => {
    if (!verificationCode) {
      toast.error('Please enter verification code');
      return;
    }
    
    setLoading(true);
    
    try {
      await axios.post(`${API}/auth/2fa/verify`, {
        code: verificationCode,
        method: method
      });
      
      toast.success('2FA enabled successfully!');
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Invalid verification code');
    }
    
    setLoading(false);
  };

  const resetModal = () => {
    setStep('choose');
    setMethod('');
    setQrCode('');
    setSecret('');
    setPhoneNumber('');
    setVerificationCode('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        resetModal();
        onClose();
      }
    }}>
      <DialogContent className="max-w-md bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center">
            <Shield className="h-5 w-5 mr-2 text-emerald-400" />
            Setup Two-Factor Authentication
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {step === 'choose' && (
            <div className="space-y-4">
              <p className="text-slate-400 text-sm">
                Choose your preferred 2FA method:
              </p>
              
              <div className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full justify-start border-slate-600 text-slate-300 hover:bg-slate-800"
                  onClick={() => handleMethodSelect('app')}
                  disabled={loading}
                >
                  <Smartphone className="h-5 w-5 mr-3" />
                  <div className="text-left">
                    <div className="font-medium">Authenticator App</div>
                    <div className="text-xs text-slate-500">Google Authenticator, Authy, etc.</div>
                  </div>
                </Button>
                
                <Button
                  variant="outline"
                  className="w-full justify-start border-slate-600 text-slate-300 hover:bg-slate-800"
                  onClick={() => setStep('phone')}
                  disabled={loading}
                >
                  <Phone className="h-5 w-5 mr-3" />
                  <div className="text-left">
                    <div className="font-medium">SMS Text Messages</div>
                    <div className="text-xs text-slate-500">Receive codes via SMS</div>
                  </div>
                </Button>
              </div>
            </div>
          )}
          
          {step === 'phone' && (
            <div className="space-y-4">
              <div>
                <Label className="text-slate-200">Phone Number</Label>
                <Input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+1234567890"
                  className="bg-slate-800 border-slate-600 text-white mt-2"
                />
              </div>
              
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setStep('choose')}
                  className="flex-1 border-slate-600 text-slate-300"
                >
                  Back
                </Button>
                <Button
                  onClick={handlePhoneSubmit}
                  disabled={loading}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {loading ? 'Setting up...' : 'Continue'}
                </Button>
              </div>
            </div>
          )}
          
          {step === 'verify' && (
            <div className="space-y-4">
              {method === 'app' && qrCode && (
                <div className="text-center space-y-4">
                  <div className="bg-white p-4 rounded-lg inline-block">
                    <img src={qrCode} alt="2FA QR Code" className="w-48 h-48" />
                  </div>
                  <p className="text-slate-400 text-sm">
                    Scan this QR code with your authenticator app
                  </p>
                  <div className="bg-slate-800 p-3 rounded border border-slate-600">
                    <p className="text-slate-300 text-xs break-all">Secret: {secret}</p>
                  </div>
                </div>
              )}
              
              <div>
                <Label className="text-slate-200">Verification Code</Label>
                <Input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  placeholder="Enter 6-digit code"
                  className="bg-slate-800 border-slate-600 text-white mt-2"
                />
              </div>
              
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setStep('choose')}
                  className="flex-1 border-slate-600 text-slate-300"
                >
                  Back
                </Button>
                <Button
                  onClick={handleVerification}
                  disabled={loading}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {loading ? 'Verifying...' : 'Verify & Enable'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// 2FA Login Modal
const TwoFALoginModal = ({ isOpen, onClose, onSuccess, method = 'app' }) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!code) {
      toast.error('Please enter verification code');
      return;
    }
    
    setLoading(true);
    
    try {
      const response = await axios.post(`${API}/auth/2fa/login`, {
        code: code,
        method: method
      });
      
      onSuccess(response.data);
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Invalid verification code');
    }
    
    setLoading(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center">
            <Shield className="h-5 w-5 mr-2 text-emerald-400" />
            Two-Factor Authentication
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <p className="text-slate-400 text-sm">
            {method === 'app' 
              ? 'Enter the code from your authenticator app:'
              : 'Enter the code sent to your phone:'}
          </p>
          
          <div>
            <Input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter 6-digit code"
              className="bg-slate-800 border-slate-600 text-white"
              onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
            />
          </div>
          
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {loading ? 'Verifying...' : 'Verify'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Analytics Dashboard Component
const AnalyticsDashboard = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      const response = await axios.get(`${API}/analytics/dashboard`);
      setAnalytics(response.data);
    } catch (error) {
      toast.error('Failed to load analytics data');
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-400">Loading analytics...</div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-400">No analytics data available</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Total Files</p>
                <p className="text-2xl font-bold text-white">{formatNumber(analytics.total_files)}</p>
              </div>
              <FileText className="h-8 w-8 text-emerald-400" />
            </div>
            <div className="flex items-center mt-2 text-sm">
              <ArrowUp className="h-4 w-4 text-green-500 mr-1" />
              <span className="text-green-500">{analytics.files_this_week}</span>
              <span className="text-slate-400 ml-1">this week</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Total Downloads</p>
                <p className="text-2xl font-bold text-white">{formatNumber(analytics.total_downloads)}</p>
              </div>
              <Download className="h-8 w-8 text-blue-400" />
            </div>
            <div className="flex items-center mt-2 text-sm">
              <ArrowUp className="h-4 w-4 text-green-500 mr-1" />
              <span className="text-green-500">{analytics.downloads_this_week}</span>
              <span className="text-slate-400 ml-1">this week</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Storage Used</p>
                <p className="text-2xl font-bold text-white">{formatBytes(analytics.storage_used)}</p>
              </div>
              <HardDrive className="h-8 w-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Active Files</p>
                <p className="text-2xl font-bold text-white">
                  {analytics.total_files - analytics.total_downloads}
                </p>
              </div>
              <Activity className="h-8 w-8 text-orange-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Activity Chart */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <LineChart className="h-5 w-5 mr-2 text-emerald-400" />
              Daily Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics.daily_activity.slice(-7).map((day, index) => {
                const date = new Date(day.date);
                const maxValue = Math.max(
                  ...analytics.daily_activity.map(d => Math.max(d.uploads, d.downloads))
                );
                
                return (
                  <div key={index} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-300">
                        {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </span>
                      <span className="text-slate-400">
                        {day.uploads} uploads, {day.downloads} downloads
                      </span>
                    </div>
                    <div className="flex space-x-2">
                      <div className="flex-1">
                        <div className="bg-slate-700 rounded-full h-2">
                          <div
                            className="bg-emerald-500 h-2 rounded-full"
                            style={{ width: `${maxValue > 0 ? (day.uploads / maxValue) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="bg-slate-700 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full"
                            style={{ width: `${maxValue > 0 ? (day.downloads / maxValue) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* File Types Chart */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <PieChart className="h-5 w-5 mr-2 text-emerald-400" />
              File Types
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.top_file_types.map((type, index) => {
                const percentage = analytics.total_files > 0 
                  ? (type.count / analytics.total_files) * 100 
                  : 0;
                
                const colors = ['bg-emerald-500', 'bg-blue-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500'];
                
                return (
                  <div key={index} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-300 capitalize">
                        {type.type === 'unknown' ? 'Others' : type.type}
                      </span>
                      <span className="text-slate-400">
                        {type.count} files ({formatBytes(type.size)})
                      </span>
                    </div>
                    <div className="bg-slate-700 rounded-full h-2">
                      <div
                        className={`${colors[index % colors.length]} h-2 rounded-full`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <Activity className="h-5 w-5 mr-2 text-emerald-400" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {analytics.recent_activities.length > 0 ? (
              analytics.recent_activities.map((activity, index) => {
                const timestamp = new Date(activity.timestamp);
                const iconMap = {
                  FILE_UPLOADED: Upload,
                  FILE_DOWNLOADED: Download,
                  USER_LOGIN: User,
                  '2FA_ENABLED': Shield,
                  '2FA_LOGIN_SUCCESS': CheckCircle
                };
                
                const Icon = iconMap[activity.action] || Activity;
                
                return (
                  <div key={index} className="flex items-center space-x-3 p-3 bg-slate-700/30 rounded-lg">
                    <Icon className={`h-5 w-5 ${activity.success ? 'text-emerald-400' : 'text-red-400'}`} />
                    <div className="flex-1">
                      <div className="text-slate-200 text-sm font-medium">
                        {activity.action.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase())}
                      </div>
                      <div className="text-slate-400 text-xs">
                        {timestamp.toLocaleDateString()} {timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                    {activity.details?.filename && (
                      <div className="text-slate-400 text-xs">
                        {activity.details.filename}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-slate-400">
                <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No recent activity</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Drag and Drop Upload Component
const DragDropUpload = ({ onFilesSelected, selectedFiles = [] }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef();

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      onFilesSelected([...selectedFiles, ...files]);
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      onFilesSelected([...selectedFiles, ...files]);
    }
  };

  const removeFile = (index) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    onFilesSelected(newFiles);
  };

  return (
    <div className="space-y-4">
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 cursor-pointer ${
          isDragOver
            ? 'border-emerald-400 bg-emerald-400/5'
            : 'border-slate-600 hover:border-emerald-500 hover:bg-emerald-500/5'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          data-testid="file-input"
        />
        
        <Upload className="h-12 w-12 mx-auto mb-4 text-slate-400" />
        <h3 className="text-lg font-medium text-white mb-2">
          {isDragOver ? 'Drop files here' : 'Drag & drop files here'}
        </h3>
        <p className="text-slate-400 mb-4">
          Or click to select files from your device
        </p>
        <Button
          variant="outline"
          className="border-emerald-600 text-emerald-400 hover:bg-emerald-600 hover:text-white"
        >
          Choose Files
        </Button>
      </div>

      {/* Selected Files List */}
      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <Label className="text-slate-200">Selected Files ({selectedFiles.length})</Label>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {selectedFiles.map((file, index) => (
              <div key={index} className="flex items-center justify-between bg-slate-700/30 rounded-lg p-3">
                <div className="flex items-center space-x-3">
                  <FileText className="h-5 w-5 text-emerald-400" />
                  <div>
                    <p className="text-slate-200 text-sm font-medium">{file.name}</p>
                    <p className="text-slate-400 text-xs">
                      {formatBytes(file.size)}
                    </p>
                  </div>
                  {FilePreviewUtils.isPreviewable(file.name) && (
                    <Badge variant="secondary" className="text-xs">
                      Previewable
                    </Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(index);
                  }}
                  className="text-slate-400 hover:text-red-400"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Auth Context
const AuthContext = React.createContext();

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const [requires2FA, setRequires2FA] = useState(false);
  const [tempToken, setTempToken] = useState(null);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    setLoading(false);
  }, [token]);

  const login = (userData, authToken, needs2FA = false) => {
    if (needs2FA) {
      setRequires2FA(true);
      setTempToken(authToken);
      axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
    } else {
      setUser(userData);
      setToken(authToken);
      setRequires2FA(false);
      setTempToken(null);
      localStorage.setItem('token', authToken);
      axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
    }
  };

  const complete2FA = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    setRequires2FA(false);
    setTempToken(null);
    localStorage.setItem('token', authToken);
    axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setRequires2FA(false);
    setTempToken(null);
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      login, 
      logout, 
      loading, 
      requires2FA, 
      complete2FA,
      tempToken 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// Landing Page Component
const LandingPage = () => {
  const [showAuth, setShowAuth] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Navigation */}
      <nav className="border-b border-slate-700/50 backdrop-blur-sm bg-slate-900/80">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-emerald-600 rounded-lg">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <span className="text-2xl font-bold text-white">FileDrop</span>
            </div>
            <Button 
              onClick={() => setShowAuth(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              data-testid="get-started-btn"
            >
              Get Started
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="container mx-auto px-6 py-20">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-6xl font-bold text-white mb-6 leading-tight">
            Zero Trust
            <span className="text-emerald-400 block">Secure File Sharing</span>
          </h1>
          <p className="text-xl text-slate-300 mb-12 leading-relaxed">
            Enterprise-grade file sharing with end-to-end encryption. Your files are encrypted 
            in your browser and never stored in plaintext on our servers.
          </p>
          
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
              <Lock className="h-12 w-12 text-emerald-400 mb-4 mx-auto" />
              <h3 className="text-xl font-semibold text-white mb-2">End-to-End Encrypted</h3>
              <p className="text-slate-400">Files encrypted in your browser with AES-256. We never see your data.</p>
            </div>
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
              <Shield className="h-12 w-12 text-emerald-400 mb-4 mx-auto" />
              <h3 className="text-xl font-semibold text-white mb-2">Two-Factor Authentication</h3>
              <p className="text-slate-400">Enhanced security with 2FA support via apps or SMS.</p>
            </div>
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
              <BarChart3 className="h-12 w-12 text-emerald-400 mb-4 mx-auto" />
              <h3 className="text-xl font-semibold text-white mb-2">Analytics Dashboard</h3>
              <p className="text-slate-400">Track usage, downloads, and file sharing insights.</p>
            </div>
          </div>

          <Button 
            onClick={() => setShowAuth(true)}
            size="lg"
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 text-lg"
            data-testid="hero-get-started-btn"
          >
            Start Sharing Securely
          </Button>
        </div>
      </div>

      {/* Auth Modal */}
      {showAuth && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md">
            <AuthForm onClose={() => setShowAuth(false)} />
          </div>
        </div>
      )}
    </div>
  );
};

// Authentication Form Component
const AuthForm = ({ onClose }) => {
  const { login } = React.useContext(AuthContext);
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ email: '', password: '', name: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/register';
      const payload = isLogin 
        ? { email: formData.email, password: formData.password }
        : formData;

      const response = await axios.post(`${API}${endpoint}`, payload);
      
      login(response.data.user, response.data.access_token, response.data.requires_2fa);
      toast.success(isLogin ? 'Logged in successfully!' : 'Account created successfully!');
      
      if (!response.data.requires_2fa) {
        onClose();
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Authentication failed');
    }
    
    setLoading(false);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">
          {isLogin ? 'Sign In' : 'Create Account'}
        </h2>
        <Button variant="ghost" onClick={onClose} className="text-slate-400">
          ×
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {!isLogin && (
          <div>
            <Label htmlFor="name" className="text-slate-200">Full Name</Label>
            <Input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({...prev, name: e.target.value}))}
              className="bg-slate-800 border-slate-600 text-white"
              required={!isLogin}
              data-testid="name-input"
            />
          </div>
        )}
        
        <div>
          <Label htmlFor="email" className="text-slate-200">Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData(prev => ({...prev, email: e.target.value}))}
            className="bg-slate-800 border-slate-600 text-white"
            required
            data-testid="email-input"
          />
        </div>
        
        <div>
          <Label htmlFor="password" className="text-slate-200">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={(e) => setFormData(prev => ({...prev, password: e.target.value}))}
              className="bg-slate-800 border-slate-600 text-white pr-10"
              required
              data-testid="password-input"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 text-slate-400 hover:text-white"
              onClick={() => setShowPassword(!showPassword)}
              data-testid="toggle-password-btn"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        
        <Button 
          type="submit" 
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
          disabled={loading}
          data-testid="auth-submit-btn"
        >
          {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
        </Button>
      </form>

      <div className="mt-6 text-center">
        <Button 
          variant="link" 
          onClick={() => setIsLogin(!isLogin)}
          className="text-emerald-400 hover:text-emerald-300"
          data-testid="toggle-auth-mode-btn"
        >
          {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
        </Button>
      </div>
    </div>
  );
};

// Dashboard Component
const Dashboard = () => {
  const { user, logout } = React.useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('upload');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [show2FAModal, setShow2FAModal] = useState(false);

  useEffect(() => {
    loadMyFiles();
  }, []);

  const loadMyFiles = async () => {
    try {
      const response = await axios.get(`${API}/files/my-files`);
      setFiles(response.data);
    } catch (error) {
      toast.error('Failed to load files');
    }
  };

  const handle2FASuccess = () => {
    toast.success('2FA settings updated successfully!');
    // Refresh user data if needed
  };

  const disable2FA = async () => {
    try {
      await axios.post(`${API}/auth/2fa/disable`);
      toast.success('2FA disabled successfully');
      // You might want to refresh user data here
    } catch (error) {
      toast.error('Failed to disable 2FA');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" data-testid="dashboard">
      {/* Navigation */}
      <nav className="border-b border-slate-700/50 backdrop-blur-sm bg-slate-900/80">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-emerald-600 rounded-lg">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <span className="text-2xl font-bold text-white">FileDrop</span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-slate-300">Welcome, {user?.name}</span>
              <Button 
                variant="outline"
                onClick={logout}
                className="border-slate-600 text-slate-300 hover:bg-slate-800"
                data-testid="logout-btn"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8">
        <div className="max-w-6xl mx-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-4 bg-slate-800 border-slate-700">
              <TabsTrigger 
                value="upload" 
                className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
                data-testid="upload-tab"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload & Share
              </TabsTrigger>
              <TabsTrigger 
                value="files" 
                className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
                data-testid="files-tab"
              >
                <FileText className="h-4 w-4 mr-2" />
                My Files
              </TabsTrigger>
              <TabsTrigger 
                value="analytics" 
                className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
                data-testid="analytics-tab"
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                Analytics
              </TabsTrigger>
              <TabsTrigger 
                value="security" 
                className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
                data-testid="security-tab"
              >
                <Settings className="h-4 w-4 mr-2" />
                Security
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="space-y-6">
              <FileUpload onUploadComplete={loadMyFiles} />
            </TabsContent>

            <TabsContent value="files" className="space-y-6">
              <FileList files={files} onRefresh={loadMyFiles} />
            </TabsContent>

            <TabsContent value="analytics" className="space-y-6">
              <AnalyticsDashboard />
            </TabsContent>

            <TabsContent value="security" className="space-y-6">
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center">
                    <Shield className="h-5 w-5 mr-2 text-emerald-400" />
                    Security Settings
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Manage your account security and two-factor authentication
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg">
                    <div>
                      <h3 className="text-white font-medium">Two-Factor Authentication</h3>
                      <p className="text-slate-400 text-sm">
                        Add an extra layer of security to your account
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      {user?.two_fa_enabled ? (
                        <>
                          <Badge variant="secondary" className="bg-green-900 text-green-300">
                            Enabled
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={disable2FA}
                            className="border-slate-600 text-slate-300"
                          >
                            Disable
                          </Button>
                        </>
                      ) : (
                        <>
                          <Badge variant="secondary" className="bg-slate-700 text-slate-300">
                            Disabled
                          </Badge>
                          <Button
                            size="sm"
                            onClick={() => setShow2FAModal(true)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            Enable 2FA
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* 2FA Setup Modal */}
      <TwoFAModal 
        isOpen={show2FAModal}
        onClose={() => setShow2FAModal(false)}
        onSuccess={handle2FASuccess}
      />
    </div>
  );
};

// File Upload Component - Enhanced with drag & drop
const FileUpload = ({ onUploadComplete }) => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [expireHours, setExpireHours] = useState(24);
  const [downloadLimit, setDownloadLimit] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [shareResult, setShareResult] = useState(null);
  const [showQRCode, setShowQRCode] = useState(false);
  const [preview, setPreview] = useState(null);

  const handleUpload = async () => {
    if (selectedFiles.length === 0 || !password) {
      toast.error('Please select files and set a password');
      return;
    }

    setUploading(true);
    setUploadProgress(10);

    try {
      // For now, upload the first file (can be enhanced for bulk upload)
      const file = selectedFiles[0];
      
      // Encrypt file
      setUploadProgress(30);
      const { encryptedFile, encryptedKeyBlob } = await CryptoUtils.encryptFile(file, password);
      
      setUploadProgress(60);
      
      // Create form data
      const formData = new FormData();
      const encryptedBlob = new Blob([encryptedFile], { type: 'application/octet-stream' });
      formData.append('file', encryptedBlob, file.name);
      
      const metadata = {
        original_filename: file.name,
        encrypted_key_blob: encryptedKeyBlob,
        expires_hours: expireHours,
        download_limit: downloadLimit ? parseInt(downloadLimit) : null
      };
      formData.append('metadata', JSON.stringify(metadata));
      
      setUploadProgress(80);
      
      // Upload
      const response = await axios.post(`${API}/files/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      setUploadProgress(100);
      setShareResult(response.data);
      toast.success('File uploaded and encrypted successfully!');
      onUploadComplete();
      
      // Reset form
      setSelectedFiles([]);
      setPassword('');
      setExpireHours(24);
      setDownloadLimit('');
      
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Upload failed');
    }
    
    setUploading(false);
    setUploadProgress(0);
  };

  const copyShareLink = () => {
    const shareUrl = `${window.location.origin}/share/${shareResult.share_link}`;
    
    // Method that works reliably across all browsers
    const textArea = document.createElement('textarea');
    textArea.value = shareUrl;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    textArea.style.opacity = '0';
    textArea.setAttribute('readonly', '');
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, 99999); // For mobile devices
    
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        toast.success('Share link copied to clipboard!');
      } else {
        // Show the URL in a toast for manual copy
        toast.info(`Copy this link: ${shareUrl}`, { duration: 8000 });
      }
    } catch (err) {
      // Final fallback - show the URL in a toast
      toast.info(`Copy this link: ${shareUrl}`, { duration: 8000 });
    } finally {
      document.body.removeChild(textArea);
    }
  };

  const showFilePreview = async (file) => {
    const previewData = await FilePreviewUtils.generatePreview(file);
    setPreview(previewData);
  };

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center">
          <Upload className="h-5 w-5 mr-2 text-emerald-400" />
          Upload & Encrypt Files
        </CardTitle>
        <CardDescription className="text-slate-400">
          Files are encrypted in your browser before upload. We never see your data.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enhanced Drag & Drop Upload */}
        <DragDropUpload 
          onFilesSelected={setSelectedFiles} 
          selectedFiles={selectedFiles}
        />

        {/* File Preview Buttons */}
        {selectedFiles.length > 0 && (
          <div className="space-y-2">
            <Label className="text-slate-200">File Actions</Label>
            <div className="flex flex-wrap gap-2">
              {selectedFiles.map((file, index) => (
                FilePreviewUtils.isPreviewable(file.name) && (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    onClick={() => showFilePreview(file)}
                    className="border-slate-600 text-slate-300"
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Preview {file.name}
                  </Button>
                )
              ))}
            </div>
          </div>
        )}

        {/* Password */}
        <div>
          <Label className="text-slate-200">Encryption Password</Label>
          <div className="relative mt-2">
            <Input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter a strong password for encryption"
              className="bg-slate-800 border-slate-600 text-white pr-10"
              data-testid="encryption-password-input"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 text-slate-400 hover:text-white"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Recipients will need this password to decrypt and download the file.
          </p>
        </div>

        {/* Settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-slate-200">Expire After (hours)</Label>
            <Input
              type="number"
              value={expireHours}
              onChange={(e) => setExpireHours(parseInt(e.target.value) || 24)}
              min="1"
              max="168"
              className="bg-slate-800 border-slate-600 text-white mt-2"
              data-testid="expire-hours-input"
            />
          </div>
          <div>
            <Label className="text-slate-200">Download Limit (optional)</Label>
            <Input
              type="number"
              value={downloadLimit}
              onChange={(e) => setDownloadLimit(e.target.value)}
              placeholder="Unlimited"
              className="bg-slate-800 border-slate-600 text-white mt-2"
              data-testid="download-limit-input"
            />
          </div>
        </div>

        {/* Upload Progress */}
        {uploading && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-slate-300">
              <span>Uploading...</span>
              <span>{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} className="bg-slate-700" />
          </div>
        )}

        {/* Share Result */}
        {shareResult && (
          <Card className="bg-emerald-900/20 border-emerald-700/50">
            <CardHeader>
              <CardTitle className="text-emerald-400 flex items-center">
                <CheckCircle className="h-5 w-5 mr-2" />
                File Shared Successfully
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label className="text-slate-200">Share Link</Label>
                  <div className="flex mt-1">
                    <Input
                      value={`${window.location.origin}/share/${shareResult.share_link}`}
                      readOnly
                      className="bg-slate-800 border-slate-600 text-slate-300 flex-1"
                      data-testid="share-link-input"
                    />
                    <Button
                      onClick={copyShareLink}
                      variant="outline"
                      className="ml-2 border-slate-600 text-slate-300"
                      data-testid="copy-share-link-btn"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      onClick={() => setShowQRCode(true)}
                      variant="outline"
                      className="ml-2 border-slate-600 text-slate-300"
                      data-testid="qr-code-btn"
                    >
                      <QrCode className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-400">Expires:</span>
                    <p className="text-slate-200">
                      {shareResult.expires_at ? new Date(shareResult.expires_at).toLocaleString() : 'Never'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Download Limit:</span>
                    <p className="text-slate-200">
                      {shareResult.download_limit || 'Unlimited'}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </CardContent>
      <CardFooter>
        <Button
          onClick={handleUpload}
          disabled={selectedFiles.length === 0 || !password || uploading}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
          data-testid="upload-file-btn"
        >
          {uploading ? 'Encrypting & Uploading...' : `Encrypt & Share File${selectedFiles.length > 1 ? 's' : ''}`}
        </Button>
      </CardFooter>

      {/* File Preview Modal */}
      <FilePreview preview={preview} onClose={() => setPreview(null)} />

      {/* QR Code Modal */}
      <QRCodeModal 
        shareUrl={shareResult ? `${window.location.origin}/share/${shareResult.share_link}` : null}
        isOpen={showQRCode}
        onClose={() => setShowQRCode(false)}
      />
    </Card>
  );
};

// File List Component - Enhanced with QR codes
const FileList = ({ files, onRefresh }) => {
  const [showQRCode, setShowQRCode] = useState(false);
  const [qrUrl, setQrUrl] = useState('');

  const copyShareLink = async (shareLink) => {
    const shareUrl = `${window.location.origin}/share/${shareLink}`;
    
    // Create temporary input element method (most reliable)
    const tempInput = document.createElement('input');
    tempInput.value = shareUrl;
    tempInput.style.position = 'absolute';
    tempInput.style.left = '-9999px';
    tempInput.style.top = '0';
    document.body.appendChild(tempInput);
    
    try {
      // Select the text
      tempInput.select();
      tempInput.setSelectionRange(0, tempInput.value.length);
      
      // Try modern clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareUrl);
        toast.success('Share link copied to clipboard!');
      } else {
        // Fallback to document.execCommand
        const success = document.execCommand('copy');
        if (success) {
          toast.success('Share link copied to clipboard!');
        } else {
          // Show input field for manual copy
          tempInput.style.position = 'static';
          tempInput.style.left = 'auto';
          tempInput.style.width = '100%';
          tempInput.style.padding = '8px';
          tempInput.style.marginTop = '8px';
          tempInput.style.backgroundColor = '#334155';
          tempInput.style.border = '1px solid #475569';
          tempInput.style.borderRadius = '4px';
          tempInput.style.color = 'white';
          
          // Find the parent button and add input after it
          const buttons = document.querySelectorAll('button');
          for (let btn of buttons) {
            if (btn.textContent.includes('Copy')) {
              btn.parentNode.appendChild(tempInput);
              tempInput.focus();
              tempInput.select();
              break;
            }
          }
          
          toast.info('Please manually copy the selected link');
          return;
        }
      }
    } catch (error) {
      console.error('Copy failed:', error);
      toast.error('Copy failed. Link: ' + shareUrl);
    } finally {
      if (tempInput.parentNode === document.body) {
        document.body.removeChild(tempInput);
      }
    }
  };

  const showQRCodeModal = (shareLink) => {
    const shareUrl = `${window.location.origin}/share/${shareLink}`;
    setQrUrl(shareUrl);
    setShowQRCode(true);
  };

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center justify-between">
          <div className="flex items-center">
            <FileText className="h-5 w-5 mr-2 text-emerald-400" />
            My Shared Files
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            className="border-slate-600 text-slate-300"
            data-testid="refresh-files-btn"
          >
            Refresh
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {files.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No files shared yet. Upload your first file to get started!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {files.map((file) => (
              <div key={file.id} className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-white font-medium flex items-center">
                      {FilePreviewUtils.isPreviewable(file.original_filename) && (
                        <Badge variant="secondary" className="mr-2 text-xs">
                          Previewable
                        </Badge>
                      )}
                      {file.original_filename}
                    </h3>
                    <div className="mt-2 grid grid-cols-2 gap-4 text-sm text-slate-400">
                      <div>
                        <span className="block">Size: {formatBytes(file.file_size)}</span>
                        <span className="block">Created: {new Date(file.created_at).toLocaleDateString()}</span>
                      </div>
                      <div>
                        <span className="block">Downloads: {file.download_count}</span>
                        <span className="block">
                          Expires: {file.expires_at ? new Date(file.expires_at).toLocaleDateString() : 'Never'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyShareLink(file.share_link)}
                      className="border-slate-600 text-slate-300"
                      data-testid={`copy-link-${file.id}`}
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Copy
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => showQRCodeModal(file.share_link)}
                      className="border-slate-600 text-slate-300"
                      data-testid={`qr-code-${file.id}`}
                    >
                      <QrCode className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* QR Code Modal */}
      <QRCodeModal 
        shareUrl={qrUrl}
        isOpen={showQRCode}
        onClose={() => {
          setShowQRCode(false);
          setQrUrl('');
        }}
      />
    </Card>
  );
};

// File Download Component - Enhanced mobile compatibility
const FileDownload = () => {
  const params = useParams();
  const shareLink = params.shareLink || window.location.pathname.split('/').filter(Boolean).pop();
  const [fileInfo, setFileInfo] = useState(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadFileInfo();
  }, []);

  const loadFileInfo = async () => {
    try {
      const response = await axios.get(`${API}/files/share/${shareLink}`);
      setFileInfo(response.data);
      setError(null);
    } catch (error) {
      setError(error.response?.data?.detail || 'File not found');
    }
    setLoading(false);
  };

  const downloadFile = async () => {
    if (!password) {
      toast.error('Please enter the password');
      return;
    }

    setDownloading(true);

    try {
      // Get download data
      const response = await axios.get(`${API}/files/download/${shareLink}`);
      const { encrypted_key_blob, filename, file_url } = response.data;

      // Construct full URL for mobile compatibility
      const fullFileUrl = file_url.startsWith('http') ? file_url : `${BACKEND_URL}${file_url}`;
      
      // Download encrypted file with better error handling
      const fileResponse = await axios.get(fullFileUrl, {
        responseType: 'arraybuffer',
        timeout: 30000, // 30 second timeout for mobile networks
        headers: {
          'Accept': 'application/octet-stream',
        }
      });

      // Decrypt file
      const decryptedData = await CryptoUtils.decryptFile(
        fileResponse.data, 
        encrypted_key_blob, 
        password
      );

      // Mobile-compatible download
      const blob = new Blob([decryptedData]);
      
      // Check if we're on mobile
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      if (isMobile) {
        // For mobile devices, try multiple download methods
        try {
          // Method 1: Try native mobile download
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          a.style.display = 'none';
          
          // Add to body and trigger click with user gesture simulation
          document.body.appendChild(a);
          
          // Create a touch event to simulate user interaction
          const clickEvent = new MouseEvent('click', {
            view: window,
            bubbles: true,
            cancelable: true
          });
          
          a.dispatchEvent(clickEvent);
          
          // Cleanup
          setTimeout(() => {
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
          }, 100);
          
        } catch (mobileError) {
          // Method 2: Fallback to opening in new tab/window
          const url = window.URL.createObjectURL(blob);
          const newWindow = window.open(url, '_blank');
          
          if (!newWindow) {
            // Method 3: If popup blocked, show instructions
            toast.error('Please enable popups and try again, or long-press the download button');
            return;
          }
          
          setTimeout(() => {
            window.URL.revokeObjectURL(url);
          }, 1000);
        }
      } else {
        // Desktop browser - standard download
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }

      toast.success('File downloaded and decrypted successfully!');
      
    } catch (error) {
      console.error('Download error:', error);
      console.error('Error details:', {
        status: error.response?.status,
        message: error.message,
        url: error.config?.url,
        userAgent: navigator.userAgent
      });
      
      // More specific error messages
      if (error.response?.status === 404) {
        toast.error('File not found. The link may have expired or been deleted.');
      } else if (error.response?.status === 410) {
        toast.error('Download link has expired or download limit exceeded.');
      } else if (error.message?.includes('Network Error')) {
        toast.error('Network error. Please check your connection and try again.');
      } else if (error.message?.includes('timeout')) {
        toast.error('Download timeout. Please try again on a faster connection.');
      } else {
        const userAgent = navigator.userAgent;
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
        toast.error(`Download failed: ${error.message || 'Unknown error'}${isMobile ? ' (Mobile detected)' : ''}`);
      }
    }

    setDownloading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Card className="bg-slate-800/50 border-slate-700 max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">File Not Found</h2>
            <p className="text-slate-400">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <Card className="bg-slate-800/50 border-slate-700 max-w-md w-full">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <Download className="h-5 w-5 mr-2 text-emerald-400" />
            Secure File Download
          </CardTitle>
          <CardDescription className="text-slate-400">
            Enter the password to decrypt and download this file.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Mobile detection and warning */}
          {/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) && (
            <div className="bg-amber-900/20 border border-amber-700/50 rounded-lg p-3">
              <div className="flex items-center text-amber-400 text-sm">
                <AlertTriangle className="h-4 w-4 mr-2" />
                <span>Mobile detected: If download doesn't start, check your downloads folder or enable popups.</span>
              </div>
            </div>
          )}
          
          <div className="bg-slate-700/30 rounded-lg p-4">
            <h3 className="text-white font-medium mb-2">{fileInfo.original_filename}</h3>
            <div className="grid grid-cols-2 gap-4 text-sm text-slate-400">
              <div>
                <span className="block">Size:</span>
                <span className="text-slate-300">{formatBytes(fileInfo.file_size)}</span>
              </div>
              <div>
                <span className="block">Downloads:</span>
                <span className="text-slate-300">{fileInfo.download_count} / {fileInfo.download_limit || '∞'}</span>
              </div>
            </div>
            {fileInfo.expires_at && (
              <div className="mt-2">
                <span className="text-slate-400 text-sm block">Expires:</span>
                <span className="text-slate-300 text-sm">{new Date(fileInfo.expires_at).toLocaleString()}</span>
              </div>
            )}
          </div>

          <div>
            <Label className="text-slate-200">Decryption Password</Label>
            <div className="relative mt-2">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter the password provided by the sender"
                className="bg-slate-800 border-slate-600 text-white pr-10"
                data-testid="download-password-input"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 text-slate-400 hover:text-white"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button
            onClick={downloadFile}
            disabled={!password || downloading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            data-testid="download-file-btn"
          >
            {downloading ? (
              <div className="flex items-center">
                <Key className="h-4 w-4 mr-2 animate-spin" />
                Decrypting...
              </div>
            ) : (
              <div className="flex items-center">
                <Download className="h-4 w-4 mr-2" />
                Decrypt & Download
              </div>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

// 2FA Login Handler Component
const TwoFAHandler = () => {
  const { requires2FA, complete2FA, user } = React.useContext(AuthContext);
  const [show2FALogin, setShow2FALogin] = useState(false);
  
  // Show 2FA login modal when required
  React.useEffect(() => {
    if (requires2FA) {
      setShow2FALogin(true);
    }
  }, [requires2FA]);

  const handle2FALogin = (loginData) => {
    complete2FA(loginData.user, loginData.access_token);
    setShow2FALogin(false);
  };

  return (
    <TwoFALoginModal 
      isOpen={show2FALogin}
      onClose={() => setShow2FALogin(false)}
      onSuccess={handle2FALogin}
      method={user?.phone_number ? 'sms' : 'app'}
    />
  );
};

// Main App Component
function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<AppRouter />} />
            <Route path="/share/:shareLink" element={<FileDownload />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-right" />
        <TwoFAHandler />
      </AuthProvider>
    </div>
  );
}

// App Router Component
const AppRouter = () => {
  const { user, loading, requires2FA } = React.useContext(AuthContext);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  // Show landing page if not authenticated or if 2FA is required
  if (!user || requires2FA) {
    return <LandingPage />;
  }

  return <Dashboard />;
};

export default App;
