/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "WindowsLocationProvider.h"
#include "nsGeoPosition.h"
#include "nsIDOMGeoPositionError.h"
#include "nsComponentManagerUtils.h"
#include "prtime.h"
#include "MLSFallback.h"
#include "mozilla/Telemetry.h"

namespace mozilla {
namespace dom {

NS_IMPL_ISUPPORTS(WindowsLocationProvider::MLSUpdate, nsIGeolocationUpdate);

WindowsLocationProvider::MLSUpdate::MLSUpdate(nsIGeolocationUpdate* aCallback)
: mCallback(aCallback)
{
}

NS_IMETHODIMP
WindowsLocationProvider::MLSUpdate::Update(nsIDOMGeoPosition *aPosition)
{
  if (!mCallback) {
    return NS_ERROR_FAILURE;
  }

  nsCOMPtr<nsIDOMGeoPositionCoords> coords;
  aPosition->GetCoords(getter_AddRefs(coords));
  if (!coords) {
    return NS_ERROR_FAILURE;
  }

  Telemetry::Accumulate(Telemetry::GEOLOCATION_WIN8_SOURCE_IS_MLS, true);

  return mCallback->Update(aPosition);
}

NS_IMETHODIMP
WindowsLocationProvider::MLSUpdate::LocationUpdatePending()
{
  return NS_OK;
}

NS_IMETHODIMP
WindowsLocationProvider::MLSUpdate::NotifyError(uint16_t aError)
{
  if (!mCallback) {
    return NS_ERROR_FAILURE;
  }
  return mCallback->NotifyError(aError);
}


class LocationEvent MOZ_FINAL : public ILocationEvents
{
public:
  LocationEvent(nsIGeolocationUpdate* aCallback, WindowsLocationProvider *aProvider)
    : mCallback(aCallback), mProvider(aProvider), mCount(0) {
  }

  // IUnknown interface
  STDMETHODIMP_(ULONG) AddRef() MOZ_OVERRIDE;
  STDMETHODIMP_(ULONG) Release() MOZ_OVERRIDE;
  STDMETHODIMP QueryInterface(REFIID iid, void** ppv) MOZ_OVERRIDE;

  // ILocationEvents interface
  STDMETHODIMP OnStatusChanged(REFIID aReportType,
                               LOCATION_REPORT_STATUS aStatus) MOZ_OVERRIDE;
  STDMETHODIMP OnLocationChanged(REFIID aReportType,
                                 ILocationReport *aReport) MOZ_OVERRIDE;

private:
  nsCOMPtr<nsIGeolocationUpdate> mCallback;
  nsRefPtr<WindowsLocationProvider> mProvider;
  ULONG mCount;
};

STDMETHODIMP_(ULONG)
LocationEvent::AddRef()
{
  return InterlockedIncrement(&mCount);
}

STDMETHODIMP_(ULONG)
LocationEvent::Release()
{
  ULONG count = InterlockedDecrement(&mCount);
  if (!count) {
    delete this;
    return 0;
  }
  return count;
}

STDMETHODIMP
LocationEvent::QueryInterface(REFIID iid, void** ppv)
{
  if (iid == IID_IUnknown) {
    *ppv = static_cast<IUnknown*>(this);
  } else if (iid == IID_ILocationEvents) {
    *ppv = static_cast<ILocationEvents*>(this);
  } else {
    return E_NOINTERFACE;
  }
  AddRef();
  return S_OK;
}


STDMETHODIMP
LocationEvent::OnStatusChanged(REFIID aReportType,
                               LOCATION_REPORT_STATUS aStatus)
{
  if (aReportType != IID_ILatLongReport) {
    return S_OK;
  }

  // When registering event, REPORT_INITIALIZING is fired at first.
  // Then, when the location is found, REPORT_RUNNING is fired.
  if (aStatus == REPORT_RUNNING) {
    // location is found by Windows Location provider, we use it.
    mProvider->CancelMLSProvider();
    return S_OK;
  }

  // Cannot get current location at this time.  We use MLS instead until
  // Location API returns RUNNING status.
  if (NS_SUCCEEDED(mProvider->CreateAndWatchMLSProvider(mCallback))) {
    return S_OK;
  }

  // Cannot watch location by MLS provider.  We must return error by
  // Location API.
  uint16_t err;
  switch (aStatus) {
  case REPORT_ACCESS_DENIED:
    err = nsIDOMGeoPositionError::PERMISSION_DENIED;
    break;
  case REPORT_NOT_SUPPORTED:
  case REPORT_ERROR:
    err = nsIDOMGeoPositionError::POSITION_UNAVAILABLE;
    break;
  default:
    return S_OK;
  }
  mCallback->NotifyError(err);
  return S_OK;
}

STDMETHODIMP
LocationEvent::OnLocationChanged(REFIID aReportType,
                                 ILocationReport *aReport)
{
  if (aReportType != IID_ILatLongReport) {
    return S_OK;
  }

  nsRefPtr<ILatLongReport> latLongReport;
  if (FAILED(aReport->QueryInterface(IID_ILatLongReport,
                                     getter_AddRefs(latLongReport)))) {
    return E_FAIL;
  }

  DOUBLE latitude = 0.0;
  latLongReport->GetLatitude(&latitude);

  DOUBLE longitude = 0.0;
  latLongReport->GetLongitude(&longitude);

  DOUBLE alt = 0.0;
  latLongReport->GetAltitude(&alt);

  DOUBLE herror = 0.0;
  latLongReport->GetErrorRadius(&herror);

  DOUBLE verror = 0.0;
  latLongReport->GetAltitudeError(&verror);

  nsRefPtr<nsGeoPosition> position =
    new nsGeoPosition(latitude, longitude, alt, herror, verror, 0.0, 0.0,
                      PR_Now());
  mCallback->Update(position);

  Telemetry::Accumulate(Telemetry::GEOLOCATION_WIN8_SOURCE_IS_MLS, false);

  return S_OK;
}

NS_IMPL_ISUPPORTS(WindowsLocationProvider, nsIGeolocationProvider)

WindowsLocationProvider::WindowsLocationProvider()
{
}

WindowsLocationProvider::~WindowsLocationProvider()
{
}

NS_IMETHODIMP
WindowsLocationProvider::Startup()
{
  nsRefPtr<ILocation> location;
  if (FAILED(::CoCreateInstance(CLSID_Location, nullptr, CLSCTX_INPROC_SERVER,
                                IID_ILocation,
                                getter_AddRefs(location)))) {
    // We will use MLS provider
    return NS_OK;
  }

  IID reportTypes[] = { IID_ILatLongReport };
  if (FAILED(location->RequestPermissions(nullptr, reportTypes, 1, FALSE))) {
    // We will use MLS provider
    return NS_OK;
  }

  mLocation = location;
  return NS_OK;
}

NS_IMETHODIMP
WindowsLocationProvider::Watch(nsIGeolocationUpdate* aCallback)
{
  if (mLocation) {
    nsRefPtr<LocationEvent> event = new LocationEvent(aCallback, this);
    if (SUCCEEDED(mLocation->RegisterForReport(event, IID_ILatLongReport, 0))) {
      return NS_OK;
    }
  }

  // Cannot use Location API.  We will use MLS instead.
  mLocation = nullptr;

  return CreateAndWatchMLSProvider(aCallback);
}

NS_IMETHODIMP
WindowsLocationProvider::Shutdown()
{
  if (mLocation) {
    mLocation->UnregisterForReport(IID_ILatLongReport);
    mLocation = nullptr;
  }

  CancelMLSProvider();

  return NS_OK;
}

NS_IMETHODIMP
WindowsLocationProvider::SetHighAccuracy(bool enable)
{
  if (!mLocation) {
    // MLS provider doesn't support HighAccuracy
    return NS_OK;
  }

  LOCATION_DESIRED_ACCURACY desiredAccuracy;
  if (enable) {
    desiredAccuracy = LOCATION_DESIRED_ACCURACY_HIGH;
  } else {
    desiredAccuracy = LOCATION_DESIRED_ACCURACY_DEFAULT;
  }
  if (FAILED(mLocation->SetDesiredAccuracy(IID_ILatLongReport,
                                           desiredAccuracy))) {
    return NS_ERROR_FAILURE;
  }
  return NS_OK;
}

nsresult
WindowsLocationProvider::CreateAndWatchMLSProvider(
  nsIGeolocationUpdate* aCallback)
{
  if (mMLSProvider) {
    return NS_OK;
  }

  mMLSProvider = new MLSFallback();
  return mMLSProvider->Startup(new MLSUpdate(aCallback));
}

void
WindowsLocationProvider::CancelMLSProvider()
{
  if (!mMLSProvider) {
    return;
  }

  mMLSProvider->Shutdown();
  mMLSProvider = nullptr;
}

} // namespace dom
} // namespace mozilla
