import { Request, Response, NextFunction } from 'express';
import {
  searchAddressSuggestions,
  getApproximateLocation,
  reverseGeocodeLocation,
  getPlaceDetails,
} from './locations.service';

export async function suggestions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const q = String(req.query.q || req.query.query || '').trim();
    if (q.length < 2) {
      res.status(200).json({ success: true, data: [] });
      return;
    }

    const latitude = req.query.latitude != null ? Number(req.query.latitude) : undefined;
    const longitude = req.query.longitude != null ? Number(req.query.longitude) : undefined;

    const data = await searchAddressSuggestions(q, { latitude, longitude });
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function approximate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const location = await getApproximateLocation();
    if (!location) {
      res.status(503).json({ success: false, message: 'Could not determine approximate location' });
      return;
    }
    res.status(200).json({ success: true, data: location });
  } catch (error) {
    next(error);
  }
}

export async function reverse(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const latitude = Number(req.query.latitude ?? req.query.lat);
    const longitude = Number(req.query.longitude ?? req.query.lng);
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      res.status(400).json({ success: false, message: 'latitude and longitude are required' });
      return;
    }

    const data = await reverseGeocodeLocation(latitude, longitude);
    if (!data) {
      res.status(503).json({
        success: false,
        message: 'Could not reverse-geocode this location. Check GOOGLE_MAPS_API_KEY.',
      });
      return;
    }
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function placeDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const placeId = String(req.query.placeId || req.query.place_id || '').trim();
    if (!placeId) {
      res.status(400).json({ success: false, message: 'placeId is required' });
      return;
    }

    const data = await getPlaceDetails(placeId);
    if (!data) {
      res.status(503).json({
        success: false,
        message: 'Could not resolve this place. Check GOOGLE_MAPS_API_KEY.',
      });
      return;
    }
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}
