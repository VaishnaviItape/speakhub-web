import React, { createContext, useContext, useState, type ReactNode } from 'react';

interface SidebarSearchContextType {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  clearSearch: () => void;
}

const SidebarSearchContext = createContext<SidebarSearchContextType | undefined>(undefined);

export const SidebarSearchProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const clearSearch = () => setSearchTerm('');

  return (
    <SidebarSearchContext.Provider value={{ searchTerm, setSearchTerm, clearSearch }}>
      {children}
    </SidebarSearchContext.Provider>
  );
};

export const useSidebarSearch = (): SidebarSearchContextType => {
  const context = useContext(SidebarSearchContext);
  if (!context) {
    return {
      searchTerm: '',
      setSearchTerm: () => {},
      clearSearch: () => {},
    };
  }
  return context;
};
