import React, { useState } from "react";
import {
    Box,
    Container,
    Typography,
    Card,
    CardContent,
    CardHeader,
    Button,
    Collapse,
} from "@mui/material";

import ReaderHeader from "../../components/layouts/ReaderHeader";
import ReaderFooter from "../../components/layouts/ReaderFooter";

import InfoIcon from "@mui/icons-material/Info";
import BookIcon from "@mui/icons-material/Book";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import WarningIcon from "@mui/icons-material/Warning";
import HelpIcon from "@mui/icons-material/Help";

export default function LibraryRules() {
    const [openMore, setOpenMore] = useState(false);

    return (
        <>
            <ReaderHeader />

            <Box sx={{ py: 6, background: (t) => t.palette.grey[50] }}>
                <Container maxWidth="lg">
                    {/* TITLE */}
                    <Box textAlign="center" mb={5}>
                        <Typography variant="h3" fontWeight={900} gutterBottom>
                            Nội Quy & Hướng Dẫn Sử Dụng Thư Viện
                        </Typography>
                        <Typography color="text.secondary">
                            Tất cả quy định dưới đây nhằm giúp mọi người sử dụng thư viện dễ dàng và thoải mái nhất.
                        </Typography>
                    </Box>

                    {/* SECTION 1 – BẮT ĐẦU */}
                    <Card sx={{ mb: 4 }}>
                        <CardHeader
                            avatar={<InfoIcon color="primary" />}
                            title={<Typography fontWeight={700}>1. Bắt đầu sử dụng thư viện</Typography>}
                        />
                        <CardContent>
                            <Typography>
                                Để dùng thư viện bạn cần có <strong>tài khoản</strong> và <strong>thẻ thư viện</strong>.
                                Tạo tài khoản rất đơn giản: chỉ cần nhập tên, số điện thoại, email và xác nhận mã.
                            </Typography>

                            <Typography mt={2}>
                                Khi có tài khoản, bạn làm thẻ thư viện. Thẻ có thời hạn rõ ràng và có thể gia hạn bất cứ lúc nào.
                            </Typography>

                            <Typography mt={2} fontWeight={600}>
                                🎯 Phí làm thẻ là gì?
                            </Typography>
                            <Typography>
                                Phí làm thẻ chính là <strong>phí đảm bảo</strong>. Đây là khoản tiền thư viện giữ để đảm bảo việc
                                mượn – trả diễn ra đúng quy định. Khoản này <strong>không mất</strong>.
                            </Typography>

                            <Typography mt={2} fontWeight={600}>
                                🎯 Tiền trong thẻ dùng để làm gì?
                            </Typography>
                            <Box ml={2} mt={1}>
                                <Typography>• Trừ khi bạn trả sách trễ</Typography>
                                <Typography>• Trừ khi sách bị hư hoặc mất</Typography>
                                <Typography>• Quy định bạn được mượn tối đa bao nhiêu cuốn</Typography>
                            </Box>

                            <Typography mt={2} fontWeight={600}>
                                🎯 Tiền có được hoàn lại không?
                            </Typography>
                            <Typography>
                                Có. Nếu bạn không còn nhu cầu sử dụng thư viện, bạn sẽ được <strong>hoàn lại toàn bộ số tiền đảm bảo</strong>{" "}
                                sau khi trả hết sách và không còn khoản phạt nào.
                            </Typography>
                        </CardContent>
                    </Card>

                    {/* SECTION 2 – HẠN MỨC MƯỢN */}
                    <Card sx={{ mb: 4 }}>
                        <CardHeader
                            avatar={<CreditCardIcon color="success" />}
                            title={<Typography fontWeight={700}>2. Hạn mức mượn sách</Typography>}
                        />
                        <CardContent>
                            <Typography>
                                Bạn được mượn tối đa bao nhiêu sách tùy vào số tiền đảm bảo còn trong thẻ:
                            </Typography>

                            <Box ml={2} mt={2}>
                                <Typography>• Trên 70.000đ → mượn tối đa <strong>3 cuốn</strong></Typography>
                                <Typography>• 40.000–70.000đ → tối đa <strong>2 cuốn</strong></Typography>
                                <Typography>• 10.000–dưới 40.000đ → tối đa <strong>1 cuốn</strong></Typography>
                                <Typography>• Dưới 10.000đ → <strong>không mượn được</strong></Typography>
                            </Box>

                            <Typography mt={2}>
                                Nếu bạn đang giữ nhiều sách hơn mức cho phép vì số dư giảm, bạn không bị bắt trả ngay, nhưng{" "}
                                <strong>không được mượn thêm</strong> cho đến khi nạp tiền hoặc trả bớt sách.
                            </Typography>
                        </CardContent>
                    </Card>

                    {/* SECTION 3 – MƯỢN & TRẢ */}
                    <Card sx={{ mb: 4 }}>
                        <CardHeader
                            avatar={<BookIcon color="secondary" />}
                            title={<Typography fontWeight={700}>3. Cách mượn và trả sách</Typography>}
                        />
                        <CardContent>
                            <Typography fontWeight={600}>Mượn sách</Typography>
                            <Box ml={2} mt={1}>
                                <Typography>• Mượn trực tiếp tại quầy</Typography>
                                <Typography>• Hoặc đặt trước trên ứng dụng → đến lấy trong 3 ngày</Typography>
                            </Box>

                            <Typography fontWeight={600} mt={2}>Thời gian mượn</Typography>
                            <Typography ml={2}>• Mỗi cuốn được mượn tối đa 30 ngày</Typography>

                            <Typography fontWeight={600} mt={2}>Gia hạn</Typography>
                            <Typography ml={2}>• Bạn có thể gia hạn nếu không ai đang đợi sách và bạn không có vi phạm.</Typography>

                            <Typography fontWeight={600} mt={2}>Trả sách</Typography>
                            <Typography ml={2}>• Trả tại quầy hoặc điểm trả tự động.</Typography>
                        </CardContent>
                    </Card>

                    {/* SECTION 4 – PHẠT & BỒI THƯỜNG */}
                    <Card sx={{ mb: 4 }}>
                        <CardHeader
                            avatar={<WarningIcon color="error" />}
                            title={<Typography fontWeight={700}>4. Phạt & Bồi thường</Typography>}
                        />
                        <CardContent>
                            <Typography>Thư viện chỉ phạt khi thật sự cần thiết để bảo vệ sách và quyền lợi người dùng khác.</Typography>

                            <Box ml={2} mt={2}>
                                <Typography>• Trễ 1–7 ngày: 2.000đ/ngày</Typography>
                                <Typography>• Trễ 8–15 ngày: 3.000đ/ngày</Typography>
                                <Typography>• Trễ từ 16 ngày: 5.000đ/ngày (tối đa 50.000đ)</Typography>
                                <Typography>• Sách hư nhiều: bồi thường theo mức độ hư</Typography>
                                <Typography>• Mất sách: bồi thường 100% giá bìa</Typography>
                            </Box>

                            <Typography mt={2}>Hệ thống sẽ tự động trừ tiền trong thẻ. Nếu không đủ, bạn thanh toán phần còn thiếu.</Typography>
                        </CardContent>
                    </Card>


                </Container>
            </Box>

            <ReaderFooter maxContentWidth={1280} />
        </>
    );
}
