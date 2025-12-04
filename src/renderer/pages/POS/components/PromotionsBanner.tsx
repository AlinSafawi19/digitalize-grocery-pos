import React, { useMemo, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  Alert,
  IconButton,
  Collapse,
} from '@mui/material';
import {
  LocalOffer,
  ExpandMore,
  ExpandLess,
} from '@mui/icons-material';
import { Promotion } from '../../../services/pricing.service';

interface PromotionsBannerProps {
  promotions: Promotion[];
}

const TYPE_LABELS: Record<Promotion['type'], string> = {
  product_promotion: 'Product',
  category_promotion: 'Category',
  store_wide: 'Store-wide',
};

const TYPE_COLORS: Record<Promotion['type'], 'primary' | 'secondary' | 'success'> = {
  store_wide: 'primary',
  category_promotion: 'secondary',
  product_promotion: 'success',
};

const PromotionsBanner: React.FC<PromotionsBannerProps> = ({ promotions }) => {
  const [expanded, setExpanded] = React.useState(true);

  const getTypeLabel = useCallback((type: Promotion['type']) => {
    return TYPE_LABELS[type] || type;
  }, []);

  const getTypeColor = useCallback((type: Promotion['type']): 'primary' | 'secondary' | 'success' => {
    return TYPE_COLORS[type] || 'primary';
  }, []);

  const handleToggleExpanded = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  const handleIconButtonClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded((prev) => !prev);
  }, []);

  const paperSx = useMemo(() => ({
    mb: 2,
    borderRadius: 0,
    overflow: 'hidden',
    border: '1px solid #c0c0c0',
    boxShadow: 'none',
    backgroundColor: '#ffffff',
  }), []);

  const headerBoxSx = useMemo(() => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    p: 1.5,
    minHeight: 44,
    backgroundColor: '#e3f2fd',
    cursor: 'pointer',
    borderBottom: '1px solid #c0c0c0',
    touchAction: 'manipulation',
  }), []);

  const headerTitleBoxSx = useMemo(() => ({
    display: 'flex',
    alignItems: 'center',
    gap: 1,
  }), []);

  const headerTitleTypographySx = useMemo(() => ({
    fontSize: '16px',
    fontWeight: 600,
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#1a237e',
  }), []);

  const iconButtonSx = useMemo(() => ({
    color: '#1a237e',
    width: 40,
    height: 40,
    '&:hover': {
      backgroundColor: 'rgba(26, 35, 126, 0.1)',
    },
    '& .MuiSvgIcon-root': {
      fontSize: 20,
    },
  }), []);

  const contentBoxSx = useMemo(() => ({
    p: 2,
    backgroundColor: '#ffffff',
  }), []);

  const alertSx = useMemo(() => ({
    mb: 1,
    '&:last-child': { mb: 0 },
    borderRadius: 0,
    border: '1px solid #c0c0c0',
    backgroundColor: '#e3f2fd',
  }), []);

  const promotionBoxSx = useMemo(() => ({
    display: 'flex',
    alignItems: 'flex-start',
    gap: 1,
    flexWrap: 'wrap',
  }), []);

  const promotionContentBoxSx = useMemo(() => ({
    flex: 1,
    minWidth: '200px',
  }), []);

  const promotionTitleBoxSx = useMemo(() => ({
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    mb: 0.5,
  }), []);

  const promotionNameTypographySx = useMemo(() => ({
    fontSize: '16px',
    fontWeight: 600,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const chipSx = useMemo(() => ({
    fontSize: '14px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const descriptionTypographySx = useMemo(() => ({
    fontSize: '14px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    mb: 0.5,
  }), []);

  const dateTypographySx = useMemo(() => ({
    fontSize: '14px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#616161',
  }), []);

  const localOfferIconSx = useMemo(() => ({
    color: '#1a237e',
    fontSize: '24px',
  }), []);

  const promotionsCountText = useMemo(() => `Active Promotions (${promotions.length})`, [promotions.length]);

  if (!promotions || promotions.length === 0) {
    return null;
  }

  return (
    <Paper sx={paperSx}>
      <Box sx={headerBoxSx} onClick={handleToggleExpanded}>
        <Box sx={headerTitleBoxSx}>
          <LocalOffer sx={localOfferIconSx} />
          <Typography sx={headerTitleTypographySx}>
            {promotionsCountText}
          </Typography>
        </Box>
        <IconButton size="medium" onClick={handleIconButtonClick} sx={iconButtonSx}>
          {expanded ? <ExpandLess /> : <ExpandMore />}
        </IconButton>
      </Box>

      <Collapse in={expanded}>
        <Box sx={contentBoxSx}>
          {promotions.map((promotion) => (
            <Alert
              key={promotion.id}
              severity="info"
              icon={<LocalOffer sx={{ color: '#1a237e' }} />}
              sx={alertSx}
            >
              <Box sx={promotionBoxSx}>
                <Box sx={promotionContentBoxSx}>
                  <Box sx={promotionTitleBoxSx}>
                    <Typography sx={promotionNameTypographySx}>
                      {promotion.name}
                    </Typography>
                    <Chip
                      label={getTypeLabel(promotion.type)}
                      size="small"
                      color={getTypeColor(promotion.type)}
                      variant="outlined"
                      sx={chipSx}
                    />
                  </Box>
                  {promotion.description && (
                    <Typography sx={descriptionTypographySx}>
                      {promotion.description}
                    </Typography>
                  )}
                  <Typography sx={dateTypographySx}>
                    Valid until:{' '}
                    {promotion.endDate.toLocaleDateString()}
                  </Typography>
                </Box>
              </Box>
            </Alert>
          ))}
        </Box>
      </Collapse>
    </Paper>
  );
};

export default PromotionsBanner;

