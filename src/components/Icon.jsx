// One consistent line-icon set for the whole app (lucide). Import icons by name here only.
import {
  PenLine, TextCursorInput, ArrowRightLeft, ListChecks, CircleCheckBig, Quote, Columns2, AlignRight, Table, Image,
  ArrowLeft, Menu, Pencil, Eye, Save, Download, Printer, Plus, ChevronDown, ChevronUp, ChevronRight, Copy, Trash2, Check, X,
  Settings, Bell, Smartphone, Info, LogOut, Search, FileText, Palette, Undo2, Redo2, History, BookmarkPlus, Bookmark,
  Library, KeyRound, Languages, WifiOff, CloudCheck, CloudUpload, RotateCcw, Sparkles, ListTree, MoreVertical, School,
  Upload, Loader2, FileCheck2, Type, BookOpen, File, Users, UserRound, UserPlus, UserMinus, Share2, Link, Ticket, LogIn,
  Send, ArrowRight, ShieldCheck, PanelRight, FolderOpen,
} from 'lucide-react';

const ICONS = {
  PenLine, TextCursorInput, ArrowRightLeft, ListChecks, CircleCheckBig, Quote, Columns2, AlignRight, Table, Image,
  ArrowLeft, Menu, Pencil, Eye, Save, Download, Printer, Plus, ChevronDown, ChevronUp, ChevronRight, Copy, Trash2, Check, X,
  Settings, Bell, Smartphone, Info, LogOut, Search, FileText, Palette, Undo2, Redo2, History, BookmarkPlus, Bookmark,
  Library, KeyRound, Languages, WifiOff, CloudCheck, CloudUpload, RotateCcw, Sparkles, ListTree, MoreVertical, School,
  Upload, Loader2, FileCheck2, Type, BookOpen, File, Users, UserRound, UserPlus, UserMinus, Share2, Link, Ticket, LogIn,
  Send, ArrowRight, ShieldCheck, PanelRight, FolderOpen,
};

export default function Icon({ name, size = 20, className = '', strokeWidth = 2 }) {
  const C = ICONS[name];
  if (!C) return null;
  return <C size={size} strokeWidth={strokeWidth} className={`shrink-0 ${name === 'Loader2' ? 'animate-spin' : ''} ${className}`} aria-hidden="true" />;
}
