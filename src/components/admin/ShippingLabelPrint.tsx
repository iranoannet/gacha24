import { forwardRef } from "react";
import type { Database } from "@/integrations/supabase/types";

type ShippingRequest = {
  id: string;
  cards: Database["public"]["Tables"]["cards"]["Row"] | null;
  gacha_slots: (Database["public"]["Tables"]["gacha_slots"]["Row"] & {
    gacha_masters: Database["public"]["Tables"]["gacha_masters"]["Row"] | null;
  }) | null;
  profile: {
    user_id: string;
    display_name: string | null;
    email: string | null;
    last_name: string | null;
    first_name: string | null;
    last_name_kana: string | null;
    first_name_kana: string | null;
    postal_code: string | null;
    prefecture: string | null;
    city: string | null;
    address_line1: string | null;
    address_line2: string | null;
    phone_number: string | null;
  } | null;
};

interface ShippingLabelPrintProps {
  requests: ShippingRequest[];
}

export const ShippingLabelPrint = forwardRef<HTMLDivElement, ShippingLabelPrintProps>(
  ({ requests }, ref) => {
    return (
      <div ref={ref} className="print-container">
        <style>
          {`
            @media print {
              body * {
                visibility: hidden;
              }
              .print-container, .print-container * {
                visibility: visible;
              }
              .print-container {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
              }
              .shipping-label {
                page-break-after: always;
                page-break-inside: avoid;
              }
              .shipping-label:last-child {
                page-break-after: auto;
              }
            }
            @media screen {
              .print-container {
                display: flex;
                flex-direction: column;
                gap: 24px;
              }
            }
          `}
        </style>
        {requests.map((request, index) => {
          const p = request.profile;
          const hasAddress = p?.postal_code && p?.prefecture && p?.city && p?.address_line1;

          return (
            <div
              key={request.id}
              className="shipping-label border-2 border-black p-6 bg-white"
              style={{ width: "100mm", minHeight: "70mm" }}
            >
              {/* Header */}
              <div className="text-center border-b-2 border-black pb-2 mb-4">
                <span className="text-lg font-bold">配送ラベル</span>
                <span className="ml-4 text-sm">No. {index + 1}</span>
              </div>

              {hasAddress ? (
                <>
                  {/* Recipient Section */}
                  <div className="mb-4">
                    <div className="text-xs text-gray-600 mb-1">お届け先</div>
                    <div className="text-xl font-bold mb-1">
                      〒{p?.postal_code}
                    </div>
                    <div className="text-base leading-relaxed">
                      {p?.prefecture}{p?.city}{p?.address_line1}
                      {p?.address_line2 && <><br />{p.address_line2}</>}
                    </div>
                    <div className="text-lg font-bold mt-2">
                      {p?.last_name} {p?.first_name} 様
                    </div>
                    {p?.phone_number && (
                      <div className="text-sm text-gray-700 mt-1">
                        TEL: {p.phone_number}
                      </div>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="border-t border-dashed border-gray-400 my-3" />

                  {/* Item Info */}
                  <div className="text-xs">
                    <div className="flex justify-between mb-1">
                      <span className="text-gray-600">商品:</span>
                      <span className="font-medium">{request.cards?.name || "-"}</span>
                    </div>
                    <div className="flex justify-between mb-1">
                      <span className="text-gray-600">ガチャ:</span>
                      <span className="font-medium truncate ml-2">
                        {request.gacha_slots?.gacha_masters?.title || "-"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">ID:</span>
                      <span className="font-mono text-[10px]">{request.id.slice(0, 8)}</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-red-600 font-bold">
                  ⚠️ 住所未登録
                </div>
              )}

              {/* Footer */}
              <div className="mt-4 pt-2 border-t border-gray-300 text-[10px] text-gray-500 text-center">
                発行日: {new Date().toLocaleDateString("ja-JP")}
              </div>
            </div>
          );
        })}
      </div>
    );
  }
);

ShippingLabelPrint.displayName = "ShippingLabelPrint";
