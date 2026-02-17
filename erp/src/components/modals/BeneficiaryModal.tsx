import React, { useState, useEffect, useRef } from 'react';
import { X, Search, FileText, ExternalLink, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { locations as locationsApi, applications as applicationsApi, beneficiaries as beneficiariesApi } from '../../lib/api';
import { useToast } from '@/hooks/use-toast';
import { ApplicationDetailModal } from './ApplicationDetailModal';

interface Location {
  _id: string;
  name: string;
  code: string;
  type: string;
  parent?: string;
}

interface Application {
  _id: string;
  applicationNumber: string;
  scheme: {
    _id: string;
    name: string;
    code: string;
  };
  project: {
    _id: string;
    name: string;
  };
  status: string;
  amount?: number;
  createdAt: string;
}

interface Beneficiary {
  _id: string;
  name: string;
  phone: string;
  state: { _id: string; name: string; code: string };
  district: { _id: string; name: string; code: string };
  area: { _id: string; name: string; code: string };
  unit: { _id: string; name: string; code: string };
  status: 'active' | 'inactive' | 'pending';
  isVerified: boolean;
  verifiedBy?: { name: string };
  verifiedAt?: string;
  createdBy: { name: string };
  createdAt: string;
  applications: string[] | Application[];
}

interface BeneficiaryModalProps {
  isOpen: boolean;
  beneficiary: Beneficiary | null;
  mode: 'create' | 'edit' | 'view';
  onClose: (shouldRefresh?: boolean) => void;
}

export const BeneficiaryModal: React.FC<BeneficiaryModalProps> = ({
  isOpen,
  beneficiary,
  mode,
  onClose
}) => {
  // All hooks must be called unconditionally (React Rules of Hooks)
  const { toast } = useToast();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    state: '',
    district: '',
    area: '',
    unit: '',
    status: 'pending' as 'active' | 'inactive' | 'pending'
  });

  const [locations, setLocations] = useState<{
    states: Location[];
    districts: Location[];
    areas: Location[];
    units: Location[];
  }>({
    states: [],
    districts: [],
    areas: [],
    units: []
  });

  const [searchTerms, setSearchTerms] = useState({
    state: '',
    district: '',
    area: '',
    unit: ''
  });
  const [dropdownOpen, setDropdownOpen] = useState({
    state: false,
    district: false,
    area: false,
    unit: false
  });
  const [fieldFocused, setFieldFocused] = useState({
    state: false,
    district: false,
    area: false,
    unit: false
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [applications, setApplications] = useState<Application[]>([]);
  const [loadingApplications, setLoadingApplications] = useState(false);
  const [showApplicationDetail, setShowApplicationDetail] = useState(false);
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);

  useEffect(() => {
    if (beneficiary && (mode === 'edit' || mode === 'view')) {
      setFormData({
        name: beneficiary.name,
        phone: beneficiary.phone,
        state: beneficiary.state._id,
        district: beneficiary.district._id,
        area: beneficiary.area._id,
        unit: beneficiary.unit._id,
        status: beneficiary.status
      });
      
      setSearchTerms({
        state: beneficiary.state.name,
        district: beneficiary.district.name,
        area: beneficiary.area.name,
        unit: beneficiary.unit.name
      });

      // Fetch applications if in view mode and applications are IDs (strings)
      if (mode === 'view' && beneficiary.applications.length > 0) {
        // Check if applications are just IDs (strings) or already populated objects
        const isPopulated = typeof beneficiary.applications[0] === 'object';
        if (!isPopulated) {
          fetchApplications(beneficiary._id);
        } else {
          // Already populated, use them directly
          setApplications(beneficiary.applications as Application[]);
        }
      }
    }
    
    fetchStates();
  }, [beneficiary, mode]);

  const fetchApplications = async (beneficiaryId: string) => {
    setLoadingApplications(true);
    try {
      const response = await applicationsApi.getAll({ 
        beneficiary: beneficiaryId, 
        limit: 100 
      });
      
      if (response.success && response.data?.applications) {
        setApplications(response.data.applications);
      }
    } catch (error: any) {
      console.error('Error fetching applications:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to load applications",
        variant: "destructive"
      });
    } finally {
      setLoadingApplications(false);
    }
  };

  useEffect(() => {
    if (formData.state) {
      fetchDistricts(formData.state);
      setDropdownOpen(prev => ({ ...prev, state: false }));
    } else {
      setLocations(prev => ({ ...prev, districts: [], areas: [], units: [] }));
      setFormData(prev => ({ ...prev, district: '', area: '', unit: '' }));
      setDropdownOpen(prev => ({ ...prev, district: false, area: false, unit: false }));
    }
  }, [formData.state]);

  useEffect(() => {
    if (formData.district) {
      fetchAreas(formData.district);
      setDropdownOpen(prev => ({ ...prev, district: false }));
    } else {
      setLocations(prev => ({ ...prev, areas: [], units: [] }));
      setFormData(prev => ({ ...prev, area: '', unit: '' }));
      setDropdownOpen(prev => ({ ...prev, area: false, unit: false }));
    }
  }, [formData.district]);

  useEffect(() => {
    if (formData.area) {
      fetchUnits(formData.area);
      setDropdownOpen(prev => ({ ...prev, area: false }));
    } else {
      setLocations(prev => ({ ...prev, units: [] }));
      setFormData(prev => ({ ...prev, unit: '' }));
      setDropdownOpen(prev => ({ ...prev, unit: false }));
    }
  }, [formData.area]);

  const fetchStates = async () => {
    try {
      const response = await locationsApi.getAll({ type: 'state', limit: 100 });
      if (response.success && response.data?.locations) {
        setLocations(prev => ({ ...prev, states: response.data.locations }));
      }
    } catch (error) {
      console.error('Error fetching states:', error);
    }
  };

  const fetchDistricts = async (stateId: string) => {
    try {
      const response = await locationsApi.getAll({ type: 'district', parent: stateId, limit: 100 });
      if (response.success && response.data?.locations) {
        setLocations(prev => ({ ...prev, districts: response.data.locations }));
      }
    } catch (error) {
      console.error('Error fetching districts:', error);
    }
  };

  const fetchAreas = async (districtId: string) => {
    try {
      const response = await locationsApi.getAll({ type: 'area', parent: districtId, limit: 100 });
      if (response.success && response.data?.locations) {
        setLocations(prev => ({ ...prev, areas: response.data.locations }));
      }
    } catch (error) {
      console.error('Error fetching areas:', error);
    }
  };

  const fetchUnits = async (areaId: string) => {
    try {
      const response = await locationsApi.getAll({ type: 'unit', parent: areaId, limit: 100 });
      if (response.success && response.data?.locations) {
        setLocations(prev => ({ ...prev, units: response.data.locations }));
      }
    } catch (error) {
      console.error('Error fetching units:', error);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleLocationSelect = (type: string, locationId: string, locationName: string) => {
    setFormData(prev => ({ ...prev, [type]: locationId }));
    setSearchTerms(prev => ({ ...prev, [type]: locationName }));
    // Close the dropdown after selection
    setDropdownOpen(prev => ({ ...prev, [type]: false }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone is required';
    } else if (!/^[6-9]\d{9}$/.test(formData.phone)) {
      newErrors.phone = 'Phone must be a valid 10-digit Indian mobile number';
    }

    if (!formData.state) newErrors.state = 'State is required';
    if (!formData.district) newErrors.district = 'District is required';
    if (!formData.area) newErrors.area = 'Area is required';
    if (!formData.unit) newErrors.unit = 'Unit is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    try {
      if (mode === 'create') {
        const response = await beneficiariesApi.create(formData);
        if (response.success) {
          toast({
            title: "Success",
            description: "Beneficiary created successfully"
          });
          onClose(true);
        }
      } else if (mode === 'edit') {
        const response = await beneficiariesApi.update(beneficiary!._id, formData);
        if (response.success) {
          toast({
            title: "Success",
            description: "Beneficiary updated successfully"
          });
          onClose(true);
        }
      }
    } catch (error: any) {
      console.error('Error saving beneficiary:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save beneficiary",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Check if click is outside any location dropdown
      if (!target.closest('.location-dropdown-container')) {
        setDropdownOpen({
          state: false,
          district: false,
          area: false,
          unit: false
        });
      }
    };

    // Only add listener if any dropdown is open
    if (Object.values(dropdownOpen).some(open => open)) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  const renderLocationSelect = (
    type: 'state' | 'district' | 'area' | 'unit',
    label: string,
    options: Location[],
    disabled = false
  ) => {
    const filteredOptions = options.filter(option =>
      option.name.toLowerCase().includes(searchTerms[type].toLowerCase())
    );
    // Show selected location name when not focused, otherwise show search term for editing
    const selectedLocation = formData[type] 
      ? options.find(opt => opt._id === formData[type])
      : null;
    const displayValue = !fieldFocused[type] && selectedLocation
      ? selectedLocation.name
      : searchTerms[type];

    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label} *
        </label>
        <div className="relative location-dropdown-container">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder={`Search ${label.toLowerCase()}...`}
              value={displayValue}
              onChange={(e) => {
                const newValue = e.target.value;
                setSearchTerms(prev => ({ ...prev, [type]: newValue }));
                setDropdownOpen(prev => ({ ...prev, [type]: true }));
                // Clear selection if user is editing (typing something different from selected)
                if (formData[type] && newValue !== selectedLocation?.name) {
                  setFormData(prev => ({ ...prev, [type]: '' }));
                }
              }}
              onFocus={() => {
                if (!disabled && mode !== 'view') {
                  setFieldFocused(prev => ({ ...prev, [type]: true }));
                  setDropdownOpen(prev => ({ ...prev, [type]: true }));
                  // When focusing, if there's a selection, populate searchTerms for editing
                  if (formData[type] && selectedLocation && !searchTerms[type]) {
                    setSearchTerms(prev => ({ ...prev, [type]: selectedLocation.name }));
                  }
                }
              }}
              onBlur={() => {
                // Delay to allow click on dropdown option to register
                setTimeout(() => {
                  setFieldFocused(prev => ({ ...prev, [type]: false }));
                  // On blur, if there's a selection, update searchTerms to show the name
                  if (formData[type] && selectedLocation) {
                    setSearchTerms(prev => ({ ...prev, [type]: selectedLocation.name }));
                  }
                }, 200);
              }}
              disabled={disabled || mode === 'view'}
              className="pl-10"
            />
          </div>
          {dropdownOpen[type] && filteredOptions.length > 0 && mode !== 'view' && !disabled && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
              {filteredOptions.map((option) => (
                <button
                  key={option._id}
                  type="button"
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                  onClick={() => handleLocationSelect(type, option._id, option.name)}
                >
                  <div className="font-medium">{option.name}</div>
                  <div className="text-sm text-gray-500">{option.code}</div>
                </button>
              ))}
            </div>
          )}
        </div>
        {errors[type] && (
          <p className="mt-1 text-sm text-red-600">{errors[type]}</p>
        )}
      </div>
    );
  };

  const getTitle = () => {
    switch (mode) {
      case 'create': return 'Add New Beneficiary';
      case 'edit': return 'Edit Beneficiary';
      case 'view': return 'View Beneficiary';
      default: return 'Beneficiary';
    }
  };

  // Conditionally render content after all hooks are called
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full min-w-[60vw] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">{getTitle()}</h2>
          <button
            onClick={() => onClose()}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Basic Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  disabled={mode === 'view'}
                  placeholder="Enter beneficiary name"
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone *
                </label>
                <Input
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  disabled={mode === 'view'}
                  placeholder="Enter phone number"
                />
                {errors.phone && (
                  <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
                )}
              </div>
            </div>
          </div>

          {/* Location Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Location</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {renderLocationSelect('state', 'State', locations.states)}
              {renderLocationSelect('district', 'District', locations.districts, !formData.state)}
              {renderLocationSelect('area', 'Area', locations.areas, !formData.district)}
              {renderLocationSelect('unit', 'Unit', locations.units, !formData.area)}
            </div>
          </div>

          {/* Status (only for edit mode) */}
          {mode === 'edit' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => handleInputChange('status', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="pending">Pending</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          )}

          {/* View Mode Additional Info */}
          {mode === 'view' && beneficiary && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Additional Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <div className="px-3 py-2 bg-gray-50 rounded-md">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      beneficiary.status === 'active' ? 'bg-green-100 text-green-800' :
                      beneficiary.status === 'inactive' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {beneficiary.status}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Verified
                  </label>
                  <div className="px-3 py-2 bg-gray-50 rounded-md">
                    {beneficiary.isVerified ? 'Yes' : 'No'}
                    {beneficiary.isVerified && beneficiary.verifiedBy && (
                      <div className="text-sm text-gray-500">
                        by {beneficiary.verifiedBy.name}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Total Applications
                  </label>
                  <div className="px-3 py-2 bg-gray-50 rounded-md">
                    {beneficiary.applications.length} applications
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Created
                  </label>
                  <div className="px-3 py-2 bg-gray-50 rounded-md">
                    {new Date(beneficiary.createdAt).toLocaleDateString()}
                    <div className="text-sm text-gray-500">
                      by {beneficiary.createdBy.name}
                    </div>
                  </div>
                </div>
              </div>

              {/* Applications List */}
              {beneficiary.applications.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Applications ({applications.length})</h3>
                  {loadingApplications ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    </div>
                  ) : applications.length > 0 ? (
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">App Number</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Scheme</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Project</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Amount</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Status</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Date</th>
                            <th className="px-4 py-2 text-center text-xs font-medium text-gray-700">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {applications.map((app) => (
                            <tr key={app._id} className="hover:bg-gray-50">
                              <td className="px-4 py-2 text-sm font-medium">{app.applicationNumber || 'N/A'}</td>
                              <td className="px-4 py-2 text-sm">
                                {app.scheme ? (
                                  <>
                                    <div>{app.scheme.name}</div>
                                    <div className="text-xs text-gray-500">{app.scheme.code}</div>
                                  </>
                                ) : (
                                  <span className="text-gray-400">N/A</span>
                                )}
                              </td>
                              <td className="px-4 py-2 text-sm">
                                {app.project?.name || <span className="text-gray-400">N/A</span>}
                              </td>
                              <td className="px-4 py-2 text-sm">
                                {app.amount ? `₹${app.amount.toLocaleString()}` : <span className="text-gray-400">N/A</span>}
                              </td>
                              <td className="px-4 py-2">
                                <Badge variant="outline" className="text-xs">
                                  {app.status}
                                </Badge>
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-500">
                                {new Date(app.createdAt).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-2 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedApplicationId(app._id);
                                      setShowApplicationDetail(true);
                                    }}
                                    className="h-7 px-2"
                                    title="View Details"
                                  >
                                    <Eye className="h-3.5 w-3.5 mr-1" />
                                    Details
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      navigate(`/applications/${app._id}`);
                                      onClose();
                                    }}
                                    className="h-7 w-7 p-0"
                                    title="Open in Applications"
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-8 border rounded-lg bg-gray-50">
                      <div className="text-center">
                        <FileText className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">No applications found</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onClose()}
            >
              {mode === 'view' ? 'Close' : 'Cancel'}
            </Button>
            {mode !== 'view' && (
              <Button
                type="submit"
                disabled={loading}
              >
                {loading ? 'Saving...' : mode === 'create' ? 'Create Beneficiary' : 'Update Beneficiary'}
              </Button>
            )}
          </div>
        </form>
      </div>

      {/* Application Detail Modal */}
      <ApplicationDetailModal
        isOpen={showApplicationDetail}
        applicationId={selectedApplicationId}
        onClose={() => {
          setShowApplicationDetail(false);
          setSelectedApplicationId(null);
        }}
      />
    </div>
  );
};