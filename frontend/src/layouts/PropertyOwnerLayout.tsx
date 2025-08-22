import React from 'react'
import { Outlet } from 'react-router'
import { SidebarProvider } from '@/components/ui/sidebar'
import { PropertyOwnerSidebar } from '@/components/dashboard/propertyOwener/PropertyOwnerSidebar'



const PropertyOwnerLayout: React.FC = () => {
  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <PropertyOwnerSidebar />
        <main className="flex-1 overflow-auto">
          <div className="container mx-auto p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  )
}

export default PropertyOwnerLayout