import React from 'react'
import { Outlet } from 'react-router'
import { SidebarProvider } from '@/components/ui/sidebar'
import { PropertyOwnerSidebar } from '@/components/dashboard/propertyOwener/PropertyOwnerSidebar'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { useLocation } from 'react-router'

const PropertyOwnerLayout: React.FC = () => {
  const location = useLocation()
  
  // Function to generate breadcrumb items based on current path
  const getBreadcrumbItems = () => {
    const path = location.pathname
    const segments = path.split('/').filter(Boolean)
    
    const breadcrumbMap: { [key: string]: string } = {
      'propertyOwner': 'Property Owner',
      'dashboard': 'Dashboard',
      'properties': 'Properties',
      'createProperty': 'Create Property',
      'userProfile': 'User Profile',
      'createSaleEmployee': 'Create Sale Employee'
    }
    
    return segments.map((segment, index) => ({
      label: breadcrumbMap[segment] || segment.charAt(0).toUpperCase() + segment.slice(1),
      path: '/' + segments.slice(0, index + 1).join('/'),
      isLast: index === segments.length - 1
    }))
  }

  const breadcrumbItems = getBreadcrumbItems()

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <PropertyOwnerSidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Header with Breadcrumb */}
          <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12 bg-background border-b">
            <div className="flex items-center gap-2 px-4 w-full">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <Breadcrumb>
                <BreadcrumbList>
                  {breadcrumbItems.map((item, index) => (
                    <React.Fragment key={item.path}>
                      <BreadcrumbItem className="hidden md:block">
                        {item.isLast ? (
                          <BreadcrumbPage>{item.label}</BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink href={item.path}>
                            {item.label}
                          </BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                      {!item.isLast && (
                        <BreadcrumbSeparator className="hidden md:block" />
                      )}
                    </React.Fragment>
                  ))}
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </header>
          
          {/* Main Content Area */}
          <div className="flex-1 overflow-auto">
            <div className="w-full h-full p-6">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  )
}

export default PropertyOwnerLayout